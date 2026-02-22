'use client';

interface PricingCardProps {
  name: string;
  price: string;
  description?: string;
  label?: string;
  features: string[];
  ctaText?: string;
  highlight?: boolean;
  popular?: boolean;
}

export default function PricingCard({
  name,
  price,
  description,
  label,
  features,
  ctaText = 'Get Started',
  highlight = false,
  popular = false,
}: PricingCardProps) {
  return (
    <div
      className={`rounded-lg border ${
        highlight || popular
          ? 'border-blue-500 shadow-xl scale-105'
          : 'border-gray-200 shadow-lg'
      } bg-white p-8 flex flex-col`}
    >
      <div className="mb-6">
        <h3 className="text-2xl font-bold text-gray-900 mb-2">{name}</h3>
        <p className="text-gray-600 text-sm mb-4">{description || label || ''}</p>
        <div className="flex items-baseline">
          <span className="text-5xl font-extrabold text-gray-900">{price}</span>
        </div>
      </div>

      <ul className="space-y-3 mb-8 flex-grow">
        {features.map((feature, idx) => (
          <li key={idx} className="flex items-start">
            <svg
              className="w-5 h-5 text-green-500 mr-3 flex-shrink-0 mt-0.5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-gray-700 text-sm">{feature}</span>
          </li>
        ))}
      </ul>

      <a
        href="/pricing"
        className={`w-full py-3 px-6 rounded-lg font-semibold text-center transition-colors ${
          highlight
            ? 'bg-blue-600 hover:bg-blue-700 text-white'
            : 'bg-gray-800 hover:bg-gray-900 text-white'
        }`}
      >
        {ctaText}
      </a>
    </div>
  );
}
