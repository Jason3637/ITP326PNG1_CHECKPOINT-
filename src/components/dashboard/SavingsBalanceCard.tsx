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
        // Functional "success" color (#166534, same token as approved/positive
        // elsewhere), not the brand gradient/primary — a savings trend is a
        // status signal, and per Phase R1 those stay on the separate
        // functional palette regardless of brand color changes.
        borderColor: "#166534",
        backgroundColor: "rgba(22, 101, 52, 0.1)",
        borderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: "#166534",
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
    <Card className="animate-card-enter relative overflow-hidden">
      {/* The dashboard's one gradient accent — a thin hero strip on its most
          prominent card, not a full-page treatment (see globals.css: a
          full-page gradient here would fight with the dense transaction
          list below it). */}
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1.5 bg-brand-gradient" />

      <p className="font-accent text-sm text-neutral-500">Savings balance</p>
      <p className="mt-1 font-display text-5xl font-bold tracking-tight text-neutral-900 sm:text-6xl">
        {formatKina(balance)}
      </p>

      <div className="mt-6 h-48 sm:h-56">
        <Line data={data} options={options} aria-label="Savings balance trend, last 7 months" role="img" />
      </div>
    </Card>
  );
}
