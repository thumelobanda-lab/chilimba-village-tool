import { describe, it, expect } from "vitest";
import { buildReferenceNumber, buildReceiptData, buildReceiptMessage, buildReceiptFilename } from "./receipt.js";

describe("buildReferenceNumber", () => {
  it("strips non-alphanumerics and uppercases, prefixed with CHM-", () => {
    expect(buildReferenceNumber("4f2a9c01-abcd-1234-5678-9abcdef01234")).toBe("CHM-4F2A9C01");
  });

  it("returns an empty string for a missing id rather than throwing", () => {
    expect(buildReferenceNumber("")).toBe("");
    expect(buildReferenceNumber(undefined)).toBe("");
  });

  it("is deterministic — same id always yields the same reference", () => {
    const id = "abc123-def456";
    expect(buildReferenceNumber(id)).toBe(buildReferenceNumber(id));
  });
});

describe("buildReceiptData", () => {
  const confirmedPayment = {
    id: "pay-123-456",
    amount: 500,
    recordedAt: "2026-07-04T10:00:00.000Z",
    confirmedAt: "2026-07-05T09:00:00.000Z",
    confirmedBy: "Harriet",
  };
  const scheduleRow = { date: "2026-07-04", group: "Group A" };

  it("throws for a payment with no confirmedAt — receipts only exist for confirmed payments", () => {
    expect(() =>
      buildReceiptData({
        payment: { ...confirmedPayment, confirmedAt: null },
        memberName: "Fridah",
        groupName: "Hillcrest",
        scheduleRow,
      })
    ).toThrow(/confirmed/i);
  });

  it("throws when no payment is given", () => {
    expect(() => buildReceiptData({ memberName: "Fridah" })).toThrow(/payment is required/i);
  });

  it("assembles every field from the payment, member, group, and schedule context", () => {
    const data = buildReceiptData({
      payment: confirmedPayment,
      memberName: "Fridah",
      groupName: "Hillcrest Chilimba",
      cycleName: "Cycle 3",
      scheduleRow,
    });
    expect(data).toEqual({
      memberName: "Fridah",
      amount: 500,
      communityFundAmount: 0,
      contributionAmount: 500,
      datePaid: "2026-07-04T10:00:00.000Z",
      dueDate: "2026-07-04",
      dueGroup: "Group A",
      cycleName: "Cycle 3",
      groupName: "Hillcrest Chilimba",
      referenceNumber: "CHM-PAY12345",
      confirmedBy: "Harriet",
      confirmedAt: "2026-07-05T09:00:00.000Z",
    });
  });

  it("tolerates a missing scheduleRow/cycleName rather than throwing", () => {
    const data = buildReceiptData({ payment: confirmedPayment, memberName: "Fridah", groupName: "Hillcrest" });
    expect(data.dueDate).toBe("");
    expect(data.dueGroup).toBe("");
    expect(data.cycleName).toBe("");
  });

  it("splits amount into communityFundAmount and contributionAmount from the payment's frozen split", () => {
    const data = buildReceiptData({
      payment: { ...confirmedPayment, amount: 50, communityFundAmount: 10 },
      memberName: "Fridah",
      groupName: "Hillcrest",
      scheduleRow,
    });
    expect(data.communityFundAmount).toBe(10);
    expect(data.contributionAmount).toBe(40);
  });
});

describe("buildReceiptMessage", () => {
  const data = {
    memberName: "Fridah",
    amount: 500,
    datePaid: "2026-07-04T10:00:00.000Z",
    dueDate: "2026-07-04",
    dueGroup: "Group A",
    cycleName: "Cycle 3",
    groupName: "Hillcrest Chilimba",
    referenceNumber: "CHM-PAY12345",
    confirmedBy: "Harriet",
  };

  it("includes every field the receipt is supposed to show", () => {
    const msg = buildReceiptMessage(data);
    expect(msg).toContain("Hillcrest Chilimba");
    expect(msg).toContain("Cycle 3");
    expect(msg).toContain("Fridah");
    expect(msg).toContain("K500");
    expect(msg).toContain("2026-07-04");
    expect(msg).toContain("Group A");
    expect(msg).toContain("Harriet");
    expect(msg).toContain("CHM-PAY12345");
  });

  it("omits the cycle line entirely when there's no cycle name", () => {
    const msg = buildReceiptMessage({ ...data, cycleName: "" });
    expect(msg).not.toContain("Cycle:");
  });

  it("includes the split breakdown line when a community fund amount was deducted", () => {
    const msg = buildReceiptMessage({ ...data, communityFundAmount: 10, contributionAmount: 490 });
    expect(msg).toContain("K10 to Community Fund");
    expect(msg).toContain("K490 to contribution");
  });

  it("omits the split breakdown line when nothing was deducted", () => {
    const msg = buildReceiptMessage({ ...data, communityFundAmount: 0, contributionAmount: 500 });
    expect(msg).not.toContain("Community Fund");
  });
});

describe("buildReceiptFilename", () => {
  it("lowercases the reference number into the filename", () => {
    expect(buildReceiptFilename({ referenceNumber: "CHM-PAY12345" })).toBe("chilimba-receipt-chm-pay12345.png");
  });

  it("falls back to a generic name when there's no reference number", () => {
    expect(buildReceiptFilename({})).toBe("chilimba-receipt-receipt.png");
  });
});
