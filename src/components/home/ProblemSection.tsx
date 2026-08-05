const pains = [
  {
    title: "Money leaks and nobody can say where",
    body: "Fuel, driver advances, tolls, repairs — paid out in cash, reconciled from memory, if at all. By the time you see a number, the trip is long gone.",
  },
  {
    title: "Dispatch runs out of a phone",
    body: "Loads get matched to trucks over WhatsApp voice notes and phone calls. Nobody has one place to see what's confirmed, what's unassigned, and what's already late.",
  },
  {
    title: "Compliance is found out too late",
    body: "A truck with an expired insurance document or an overdue service is still just \"the truck that's available\" — until it isn't, and the cost is much higher than a reminder would have been.",
  },
];

export default function ProblemSection() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <span className="section-eyebrow justify-center">The old way</span>
        <h2 className="mt-4 text-3xl font-bold sm:text-4xl">
          Running a fleet shouldn&apos;t feel like guesswork.
        </h2>
      </div>

      <div className="mt-14 grid gap-6 md:grid-cols-3">
        {pains.map((pain) => (
          <div key={pain.title} className="card-surface p-6">
            <h3 className="text-lg font-semibold text-navy">{pain.title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-body">{pain.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
