const stats = [
  { value: "10+", label: "purpose-built workspaces already shipped, not stock forms" },
  { value: "6", label: "AI agents, each scoped to what it's allowed to see" },
  { value: "100%", label: "of AI writes require a human approval — no exceptions" },
];

export default function ProofSection() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <div className="rounded-df-xl border border-border bg-navy px-6 py-14 sm:px-12">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-cyan">
            From the team behind DeployGuard
          </p>
          <h2 className="mt-4 text-2xl font-bold text-white sm:text-3xl">
            An established team, built specifically for African trucking.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-slate-300">
            DeployFleet is built by the team behind DeployGuard, already
            running operations for security companies across the region.
            DeployFleet takes the same foundation and rebuilds it, module by
            module, around how trucking companies actually work.
          </p>
        </div>

        <div className="mx-auto mt-12 grid max-w-3xl gap-8 sm:grid-cols-3">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-gradient-brand text-3xl font-bold">{stat.value}</p>
              <p className="mt-2 text-sm text-slate-300">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
