"use client";

import { useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
  type ChartOptions,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { Card } from "@/components/ui/Card";
import { formatKina } from "@/lib/utils";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler);

interface SavingsBalanceCardProps {
  balance: number;
  trend: { month: string; balance: number }[];
}

export function SavingsBalanceCard({ balance, trend }: SavingsBalanceCardProps) {
  const [prefersReducedMotion] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  const data = {
    labels: trend.map((point) => point.month),
    datasets: [
      {
        data: trend.map((point) => point.balance),
        borderColor: "#0f766e",
        backgroundColor: "rgba(15, 118, 110, 0.1)",
        borderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: "#0f766e",
        pointBorderColor: "#ffffff",
        pointBorderWidth: 2,
        tension: 0.35,
        fill: true,
      },
    ],
  };

  const options: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: prefersReducedMotion ? false : { duration: 700 },
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#0f172a",
        titleColor: "#f8fafc",
        bodyColor: "#f8fafc",
        padding: 10,
        cornerRadius: 8,
        displayColors: false,
        callbacks: {
          label: (ctx) => formatKina(ctx.parsed.y ?? 0),
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: { color: "#64748b", font: { size: 11 } },
      },
      y: {
        beginAtZero: true,
        grid: { color: "#e2e8f0" },
        border: { display: false },
        ticks: {
          color: "#64748b",
          font: { size: 11 },
          callback: (value) => formatKina(Number(value)),
        },
      },
    },
  };

  return (
    <Card className="animate-card-enter">
      <p className="text-sm font-medium text-neutral-500">Savings balance</p>
      <p className="mt-1 text-5xl font-semibold text-neutral-900 sm:text-6xl">
        {formatKina(balance)}
      </p>

      <div className="mt-6 h-48 sm:h-56">
        <Line data={data} options={options} aria-label="Savings balance trend, last 7 months" role="img" />
      </div>
    </Card>
  );
}
