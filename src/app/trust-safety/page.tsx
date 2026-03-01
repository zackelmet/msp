import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faShieldHalved,
  faFileContract,
  faUserShield,
  faGavel,
  faBan,
  faCircleInfo,
} from "@fortawesome/free-solid-svg-icons";

export const metadata = {
  title: "Trust + Safety Center — MSP Pentesting",
  description:
    "Our commitment to ethical penetration testing, data security, and responsible disclosure.",
  metadataBase: new URL("https://msppentesting.vercel.app"),
  openGraph: {
    title: "Trust + Safety Center — MSP Pentesting",
    description:
      "Our commitment to ethical penetration testing, data security, and responsible disclosure.",
    url: "https://msppentesting.vercel.app/trust-safety",
    siteName: "MSP Pentesting",
  },
};

const sections = [
  {
    icon: faFileContract,
    title: "Terms of Service",
    anchor: "terms",
    content: [
      "By purchasing and using MSP Pentesting services you agree to these terms in full. If you do not agree, do not use the platform.",
      "MSP Pentesting provides automated and AI-assisted penetration testing services. All testing is performed exclusively on targets for which you have provided explicit written authorisation.",
      "Credits are non-refundable once a pentest job has been dispatched to our backend systems. Unused credits may be refunded within 14 days of purchase — contact support.",
      "We reserve the right to suspend or terminate accounts that violate these terms without notice or refund.",
      "These terms are governed by the laws of the United States. Full terms document coming soon.",
    ],
  },
  {
    icon: faUserShield,
    title: "Privacy Policy",
    anchor: "privacy",
    content: [
      "We collect only the data necessary to provide our services: your email address, payment information (processed by Stripe — we never see card details), and scan targets you submit.",
      "Scan results and reports are stored in Google Cloud Storage, accessible only to you and our backend systems. We do not sell or share your data with third parties.",
      "We use Firebase Authentication for identity management. Firestore is used to store account and pentest metadata.",
      "You may request deletion of your account and associated data at any time by contacting support@msppentesting.com.",
      "Full privacy policy document coming soon.",
    ],
  },
  {
    icon: faGavel,
    title: "Authorised Use Policy",
    anchor: "authorised-use",
    content: [
      "You must have explicit, written authorisation from the system owner before submitting any target for testing. Verbal permission is not sufficient.",
      "By submitting a target you are legally attesting that you own the system or hold documented permission from the owner to conduct penetration testing.",
      "Submitting targets you do not own or have not obtained authorisation for is a criminal offence in most jurisdictions (e.g., CFAA in the United States, Computer Misuse Act in the UK).",
      "MSP Pentesting operates in good faith on your attestation. Any misuse is solely your legal responsibility.",
    ],
  },
  {
    icon: faBan,
    title: "Prohibited Targets",
    anchor: "prohibited",
    content: [
      "The following target types are strictly prohibited regardless of claimed ownership: critical national infrastructure (power grids, water systems, financial clearing systems), government systems, healthcare systems containing patient data, and any system you have been explicitly prohibited from testing.",
      "Targets that appear to be shared hosting environments where testing could impact other tenants are also prohibited.",
      "We reserve the right to cancel any job and suspend any account if a submitted target is determined to be prohibited.",
    ],
  },
  {
    icon: faCircleInfo,
    title: "Responsible Disclosure",
    anchor: "disclosure",
    content: [
      "If you discover a security vulnerability in the MSP Pentesting platform itself, please disclose it responsibly to security@msppentesting.com.",
      "We commit to acknowledging your report within 48 hours, working to remediate confirmed issues within 30 days, and not pursuing legal action against good-faith security researchers.",
      "We do not currently operate a bug bounty programme, but we will credit researchers who assist us in improving our security.",
    ],
  },
];

export default function TrustSafetyPage() {
  return (
    <main className="min-h-screen bg-[#0a141f] text-white">
      {/* Hero */}
      <div className="border-b border-[#4590e2]/30 bg-gradient-to-b from-[#0a141f] to-[#0a1828]">
        <div className="max-w-4xl mx-auto px-6 py-20 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#4590e2]/20 border border-[#4590e2]/40 mb-6">
            <FontAwesomeIcon icon={faShieldHalved} className="text-3xl text-[#4590e2]" />
          </div>
          <h1
            className="text-4xl lg:text-5xl font-bold text-white mb-4"
            style={{ fontFamily: "var(--font-chakra-petch)" }}
          >
            Trust + Safety Center
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Our policies governing the ethical, legal, and responsible use of MSP Pentesting services.
          </p>
          <p className="mt-3 text-sm text-gray-500">Last updated: March 2026</p>
        </div>
      </div>

      {/* Quick nav */}
      <div className="border-b border-white/10 bg-[#0a141f]/80 sticky top-0 z-10 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-6 py-3 flex gap-4 overflow-x-auto text-sm">
          {sections.map((s) => (
            <a
              key={s.anchor}
              href={`#${s.anchor}`}
              className="whitespace-nowrap text-gray-400 hover:text-[#4590e2] transition-colors"
            >
              {s.title}
            </a>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-16 space-y-12">
        {sections.map((section) => (
          <section key={section.anchor} id={section.anchor} className="scroll-mt-16">
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2.5 rounded-lg bg-[#4590e2]/15 border border-[#4590e2]/30">
                <FontAwesomeIcon icon={section.icon} className="text-[#4590e2] text-lg" />
              </div>
              <h2 className="text-2xl font-bold text-white">{section.title}</h2>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
              {section.content.map((para, i) => (
                <p key={i} className="text-gray-300 leading-relaxed text-sm">
                  {para}
                </p>
              ))}
            </div>
          </section>
        ))}

        {/* Contact CTA */}
        <div className="bg-[#4590e2]/10 border border-[#4590e2]/30 rounded-xl p-8 text-center">
          <h3 className="text-xl font-bold text-white mb-2">Questions about our policies?</h3>
          <p className="text-gray-400 mb-5 text-sm">
            Our team is happy to answer any questions about how we handle your data or operate our services.
          </p>
          <Link
            href="/support"
            className="inline-block px-6 py-3 bg-[#4590e2] hover:bg-[#3a7bc8] text-white font-semibold rounded-lg transition-colors"
          >
            Contact Support
          </Link>
        </div>
      </div>
    </main>
  );
}
