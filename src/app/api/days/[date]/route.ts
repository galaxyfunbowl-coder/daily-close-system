import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/require-auth";
import {
  Department,
  ElectronicOperator,
  PaymentMethod,
} from "@prisma/client";
import { ELECTRONIC_OPERATORS } from "@/lib/constants";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function parseDate(dateStr: string): string | null {
  if (!DATE_REGEX.test(dateStr)) return null;
  const d = new Date(dateStr + "T12:00:00");
  if (Number.isNaN(d.getTime())) return null;
  return dateStr;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  const auth = await requireAuth();
  if (auth) return auth;
  const date = parseDate((await params).date);
  if (!date) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  let day = await prisma.day.findUnique({
    where: { date },
    include: {
      revenueLines: { include: { staff: true } },
      partyEvents: { include: { staff: true } },
    },
  });

  if (!day) {
    day = await prisma.day.create({
      data: {
        date,
        revenueLines: {
          create: [
            {
              department: Department.RECEPTION_BOWLING,
              subLabel: "Regular",
              total: 0,
              pos: 0,
              cash: 0,
            },
            {
              department: Department.BILIARDA,
              total: 0,
              pos: 0,
              cash: 0,
            },
            {
              department: Department.BAR,
              total: 0,
              pos: 0,
              cash: 0,
            },
            {
              department: Department.SERVICE,
              total: 0,
              pos: 0,
              cash: 0,
            },
          ],
        },
      },
      include: {
        revenueLines: { include: { staff: true } },
        partyEvents: { include: { staff: true } },
      },
    });
  }

  const staff = await prisma.staff.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({
    day: {
      id: day.id,
      date: day.date,
      notes: day.notes ?? "",
      isClosed: day.isClosed,
      zPosTotal: day.zPosTotal ?? null,
      zCashTotal: day.zCashTotal ?? null,
      revenueLines: day.revenueLines.map((r) => ({
        id: r.id,
        department: r.department,
        subLabel: r.subLabel ?? null,
        subLabelInfo: r.subLabelInfo ?? null,
        staffId: r.staffId ?? null,
        staffName: r.staff?.name ?? null,
        operator: r.operator ?? null,
        total: r.total,
        cash: r.cash,
      })),
      partyEvents: day.partyEvents.map((p) => ({
        id: p.id,
        staffId: p.staffId,
        staffName: p.staff.name,
        total: p.total,
        paymentMethod: p.paymentMethod,
        posInput: p.posInput ?? null,
        posComputed: p.posComputed,
        cashComputed: p.cashComputed,
        notes: p.notes ?? "",
      })),
    },
    staff,
  });
}

type RevenueLineInput = {
  id?: string;
  department: Department;
  subLabel?: string | null;
  subLabelInfo?: string | null;
  staffId?: string | null;
  operator?: ElectronicOperator | null;
  total: number;
  cash?: number;
};

type PartyEventInput = {
  id?: string;
  staffId: string;
  total: number;
  notes?: string | null;
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  const auth = await requireAuth();
  if (auth) return auth;
  const date = parseDate((await params).date);
  if (!date) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  let body: {
    notes?: string;
    isClosed?: boolean;
    zPosTotal?: number | null;
    zCashTotal?: number | null;
    revenueLines?: RevenueLineInput[];
    partyEvents?: PartyEventInput[];
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  for (const line of body.revenueLines ?? []) {
    if (line.total < 0) {
      return NextResponse.json(
        { error: "Invalid revenue line: total must be ≥ 0" },
        { status: 400 }
      );
    }
  }

  for (const ev of body.partyEvents ?? []) {
    if (ev.total < 0) {
      return NextResponse.json(
        { error: "Invalid party event: total must be ≥ 0" },
        { status: 400 }
      );
    }
  }

  let day = await prisma.day.findUnique({ where: { date } });
  if (!day) {
    day = await prisma.day.create({
      data: { date },
    });
  }

  await prisma.$transaction(async (tx) => {
    if (
      body.notes !== undefined ||
      body.isClosed !== undefined ||
      body.zPosTotal !== undefined ||
      body.zCashTotal !== undefined
    ) {
      await tx.day.update({
        where: { id: day!.id },
        data: {
          ...(body.notes !== undefined && { notes: body.notes }),
          ...(body.isClosed !== undefined && { isClosed: body.isClosed }),
          ...(body.zPosTotal !== undefined && { zPosTotal: body.zPosTotal }),
          ...(body.zCashTotal !== undefined && { zCashTotal: body.zCashTotal }),
        },
      });
    }

    if (body.revenueLines !== undefined) {
      await tx.revenueLine.deleteMany({ where: { dayId: day!.id } });
      if (body.revenueLines.length > 0) {
        await tx.revenueLine.createMany({
          data: body.revenueLines.map((r) => ({
            dayId: day!.id,
            department: r.department,
            subLabel: r.subLabel ?? null,
            subLabelInfo: r.subLabelInfo ?? null,
            staffId: r.staffId ?? null,
            operator: r.operator ?? null,
            total: r.total,
            pos: 0,
            cash: r.cash ?? r.total,
          })),
        });
      }
    }

    if (body.partyEvents !== undefined) {
      await tx.partyEvent.deleteMany({ where: { dayId: day!.id } });
      for (const ev of body.partyEvents) {
        await tx.partyEvent.create({
          data: {
            dayId: day!.id,
            staffId: ev.staffId,
            total: ev.total,
            paymentMethod: PaymentMethod.CASH,
            posInput: null,
            posComputed: 0,
            cashComputed: ev.total,
            notes: ev.notes ?? null,
          },
        });
      }
    }
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  const auth = await requireAuth();
  if (auth) return auth;
  const date = parseDate((await params).date);
  if (!date) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }
  try {
    await prisma.day.delete({ where: { date } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Day not found or already deleted" }, { status: 404 });
  }
}
