import type { DriveStep } from "driver.js";

// First-run product tour steps. Anchors are `data-tour="..."` attributes on the
// dashboard nav + buttons; steps with no `element` render as a centered modal.
export const tourSteps: DriveStep[] = [
  {
    popover: {
      title: "Welcome to MSP Pentesting 👋",
      description:
        "Here's a 60-second tour of how to launch a pentest, track results, and get your report. You can skip anytime.",
      align: "center",
    },
  },
  {
    element: '[data-tour="nav-ai-pentest-launch"]',
    popover: {
      title: "Launch an AI pentest",
      description:
        "Start here. Paste your targets (IPs, domains, or URLs) and launch autonomous AI-driven pentests in one shot.",
      side: "right",
    },
  },
  {
    element: '[data-tour="nav-buy-credits"]',
    popover: {
      title: "Buy AI credits",
      description:
        "Each target spends one AI credit. Pricing is volume-based — the more you buy, the lower your blended per-IP rate.",
      side: "right",
    },
  },
  {
    element: '[data-tour="nav-targets"]',
    popover: {
      title: "Organize your targets",
      description:
        "Group the assets and scope you're authorized to test into reusable Target Groups.",
      side: "right",
    },
  },
  {
    element: '[data-tour="nav-schedule"]',
    popover: {
      title: "Schedule recurring tests",
      description:
        "Set up continuous testing on a cadence so you stay covered between engagements.",
      side: "right",
    },
  },
  {
    element: '[data-tour="nav-pentests"]',
    popover: {
      title: "Track your tests",
      description:
        "Watch tests run and open finished ones here. You'll get an email the moment a report is ready.",
      side: "right",
    },
  },
  {
    element: '[data-tour="nav-launch-pentest"]',
    popover: {
      title: "Want a human?",
      description:
        "Launch an expert-led manual pentest by our CEH-certified and OSCP professionals whenever you need hands-on testing.",
      side: "right",
    },
  },
  {
    element: '[data-tour="buy-credits-btn"]',
    popover: {
      title: "Top up anytime",
      description:
        "Buy more credits from here whenever you need them. That's it — you're ready to go!",
      side: "top",
    },
  },
];
