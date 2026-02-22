#!/usr/bin/env node

/**
 * Stripe Products Setup for MSP Pentesting PTaaS Platform
 * 
 * Creates products and pricing for:
 * - AI-driven automated pentests (single purchase + monthly subscription)
 * - Manual pentesting services (basic + advanced tiers)
 */

require('dotenv').config({ path: '.env.local' });
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const PRODUCTS = [
  // AI-Driven Pentests
  {
    name: 'AI Pentest - Single Scan',
    description: 'One-time AI-driven automated penetration test across your infrastructure. Includes Nmap, OpenVAS, and OWASP ZAP scanning.',
    type: 'ai_single',
    price: 199,
    currency: 'usd',
    recurring: false,
    features: [
      'AI-powered vulnerability scanning',
      'Nmap network discovery',
      'OpenVAS vulnerability assessment',
      'OWASP ZAP web application testing',
      'Automated findings report',
      'Up to 5 targets per scan'
    ]
  },
  {
    name: 'AI Pentest - Monthly Unlimited',
    description: 'Unlimited AI-driven automated pentests. Run as many scans as you need, whenever you need them.',
    type: 'ai_monthly',
    price: 499,
    currency: 'usd',
    recurring: true,
    interval: 'month',
    features: [
      'Unlimited AI-powered scans',
      'Priority scan queue',
      'Advanced scan configurations',
      'Automated scheduling',
      'Historical trend analysis',
      'Unlimited targets',
      'API access'
    ]
  },
  
  // Manual Pentesting Services
  {
    name: 'Manual Pentest - Basic',
    description: 'Professional manual penetration testing by certified security experts. Ideal for small to medium applications.',
    type: 'manual_basic',
    price: 2000,
    currency: 'usd',
    recurring: false,
    features: [
      'Certified pentesting team',
      'Up to 3 targets/applications',
      'OWASP Top 10 coverage',
      '40 hours of testing',
      'Executive summary report',
      'Detailed technical findings',
      'Remediation recommendations',
      '2 weeks engagement timeline'
    ]
  },
  {
    name: 'Manual Pentest - Advanced',
    description: 'Comprehensive manual penetration testing for complex infrastructure. Includes web, network, and API testing.',
    type: 'manual_advanced',
    price: 5000,
    currency: 'usd',
    recurring: false,
    features: [
      'Senior pentesting specialists',
      'Unlimited targets',
      'Full-scope testing (web, network, API, mobile)',
      '120 hours of testing',
      'Executive and board-level reports',
      'Detailed technical documentation',
      'Remediation support and retesting',
      'Compliance mapping (PCI-DSS, SOC2, etc.)',
      '4-6 weeks engagement timeline',
      'Dedicated project manager'
    ]
  }
];

async function setupProducts() {
  console.log('🚀 Setting up Stripe products for MSP Pentesting PTaaS...\n');

  if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.trim() === '') {
    console.error('❌ Error: STRIPE_SECRET_KEY not found in .env.local');
    process.exit(1);
  }

  const results = {};

  for (const product of PRODUCTS) {
    try {
      console.log(`📦 Creating product: ${product.name}...`);

      // Create product
      const stripeProduct = await stripe.products.create({
        name: product.name,
        description: product.description,
        metadata: {
          type: product.type,
          features: JSON.stringify(product.features)
        }
      });

      console.log(`   ✓ Product created: ${stripeProduct.id}`);

      // Create price
      const priceData = {
        product: stripeProduct.id,
        unit_amount: product.price * 100, // Convert to cents
        currency: product.currency,
        metadata: {
          type: product.type
        }
      };

      if (product.recurring) {
        priceData.recurring = {
          interval: product.interval
        };
      }

      const stripePrice = await stripe.prices.create(priceData);

      console.log(`   ✓ Price created: ${stripePrice.id} ($${product.price}${product.recurring ? `/${product.interval}` : ''})`);

      // Store result
      results[product.type] = {
        productId: stripeProduct.id,
        priceId: stripePrice.id,
        amount: product.price,
        recurring: product.recurring || false
      };

      console.log('');
    } catch (error) {
      console.error(`   ❌ Error creating ${product.name}:`, error.message);
      console.log('');
    }
  }

  // Display environment variables to add
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Products created successfully!\n');
  console.log('📝 Add these to your .env.local file:\n');
  
  if (results.ai_single) {
    console.log(`NEXT_PUBLIC_STRIPE_PRICE_AI_SINGLE=${results.ai_single.priceId}`);
  }
  if (results.ai_monthly) {
    console.log(`NEXT_PUBLIC_STRIPE_PRICE_AI_MONTHLY=${results.ai_monthly.priceId}`);
  }
  if (results.manual_basic) {
    console.log(`NEXT_PUBLIC_STRIPE_PRICE_MANUAL_BASIC=${results.manual_basic.priceId}`);
  }
  if (results.manual_advanced) {
    console.log(`NEXT_PUBLIC_STRIPE_PRICE_MANUAL_ADVANCED=${results.manual_advanced.priceId}`);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n📊 Product Summary:\n');
  
  Object.entries(results).forEach(([type, data]) => {
    const productInfo = PRODUCTS.find(p => p.type === type);
    console.log(`${productInfo.name}:`);
    console.log(`  Product ID: ${data.productId}`);
    console.log(`  Price ID:   ${data.priceId}`);
    console.log(`  Amount:     $${data.amount}${data.recurring ? '/month' : ''}`);
    console.log('');
  });

  console.log('🔗 View in Stripe Dashboard:');
  console.log('   https://dashboard.stripe.com/products\n');
}

// Run setup
setupProducts()
  .then(() => {
    console.log('✨ Setup complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Setup failed:', error.message);
    process.exit(1);
  });
