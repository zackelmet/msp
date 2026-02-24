import GetStartedButton from "../shared/GetStartedButton";

export default function TrustSection() {
  return (
    <section className="w-full py-16 lg:py-24 bg-base-100">
      <div className="max-w-5xl mx-auto px-8 text-center">
        <h2 className="text-4xl lg:text-5xl font-bold mb-6">
          Trusted by Security Teams Worldwide
        </h2>
        <p className="text-2xl font-semibold text-primary mb-8">
          Professional Pentesting. Powerful Results.
        </p>

        <div className="prose lg:prose-xl mx-auto mb-12">
          <p className="text-lg leading-relaxed">
            Security teams and MSPs rely on MSP Pentesting for comprehensive
            penetration testing services. From AI-driven automated scans to
            expert-led manual assessments, we deliver the insights you need
            to secure your infrastructure.
          </p>
          <p className="text-lg leading-relaxed mt-6">
            We are confident you&apos;ll find the value. Get started entirely
            risk-free today with our{" "}
            <strong>7-day, no-questions-asked refund policy</strong>.
          </p>
        </div>

        <GetStartedButton />
      </div>
    </section>
  );
}
