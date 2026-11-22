import { describe, it, expect, vi } from "vitest";
import { phoneNumberValidator } from "./patient.service.js";

function makeRes() {
  const res = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
}

describe("profile phone number validation", () => {
  for (const field of ["phoneNumber", "emergencyContactPhone"]) {
    it.each(["123", "1234567890", "123456789012", "0912345678a", "", "1234567890123456"])(
      `rejects invalid ${field}: %j`,
      async (value) => {
        const res = makeRes();
        await phoneNumberValidator({ body: { [field]: value } }, res);
        expect(res.status).toHaveBeenCalledWith(400);
      },
    );
  }

  it("accepts valid phone and emergency contact numbers", async () => {
    const res = makeRes();
    expect(await phoneNumberValidator({ body: {
      phoneNumber: "09123456789",
      emergencyContactPhone: "09987654321",
    } }, res)).toBe(true);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("validates the emergency contact when the phone number is omitted", async () => {
    const res = makeRes();
    await phoneNumberValidator({ body: { emergencyContactPhone: "invalid" } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Invalid emergency contact phone number",
    });
  });

  it("allows partial updates that omit both numbers", async () => {
    const res = makeRes();
    expect(await phoneNumberValidator({ body: { gender: "Female" } }, res)).toBe(true);
    expect(res.status).not.toHaveBeenCalled();
  });
});
