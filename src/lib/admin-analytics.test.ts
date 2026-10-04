import { describe, expect, it } from "vitest";
import { analyticsHref, categoryRows, formatHours, formatRate, lastDays, parseDateParam, weeklyWindows } from "./admin-analytics";

describe("admin analytics helpers", () => {
  it("accepts only real YYYY-MM-DD dates", () => {
    expect(parseDateParam("2026-10-05")).toBe("2026-10-05");
    expect(parseDateParam("2026-02-30")).toBeNull();
    expect(parseDateParam("05/10/2026")).toBeNull();
    expect(parseDateParam(["2026-10-05"])).toBeNull();
    expect(parseDateParam(undefined)).toBeNull();
  });

  it("builds contiguous 7-day windows ending on the given day, oldest first", () => {
    const w = weeklyWindows("2026-10-05", 8);
    expect(w).toHaveLength(8);
    expect(w.at(-1)).toEqual({ from: "2026-09-29", to: "2026-10-05", label: "Sep 29–Oct 5", axisLabel: "Sep 29" });
    expect(w[0]).toEqual({ from: "2026-08-11", to: "2026-08-17", label: "Aug 11–Aug 17", axisLabel: "Aug 11" });
    for (let i = 1; i < w.length; i++) {
      const prevEnd = new Date(`${w[i - 1].to}T00:00:00Z`).getTime();
      expect(new Date(`${w[i].from}T00:00:00Z`).getTime() - prevEnd).toBe(86400000);
    }
  });

  it("makes date presets and links", () => {
    expect(lastDays("2026-10-05", 30)).toEqual({ from: "2026-09-06", to: "2026-10-05" });
    expect(analyticsHref({ from: "2026-09-06", to: "2026-10-05" })).toBe("/admin/analytics?from=2026-09-06&to=2026-10-05");
    expect(analyticsHref()).toBe("/admin/analytics");
  });

  it("formats rates and durations without inventing values", () => {
    expect(formatRate(0.75)).toBe("75%");
    expect(formatRate(0.6667)).toBe("66.7%");
    expect(formatRate(null)).toBe("—");
    expect(formatHours(5.5)).toBe("5.5 hours");
    expect(formatHours(60)).toBe("2.5 days");
    expect(formatHours(null)).toBe("—");
  });

  it("orders PRIME categories by tier, others last", () => {
    const rows = categoryRows({
      "PRIME 10": { count: 1, amount: 9000 },
      "not PRIME": { count: 1, amount: 50 },
      "PRIME 2": { count: 4, amount: 2000 },
      "PRIME 1": { count: 3, amount: 600 },
    });
    expect(rows.map((r) => r.category)).toEqual(["PRIME 1", "PRIME 2", "PRIME 10", "not PRIME"]);
    expect(rows[1]).toEqual({ category: "PRIME 2", count: 4, amount: 2000 });
  });
});
