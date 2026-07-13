import fs from "fs";
import path from "path";
import type { Metadata } from "next";
import type { ComponentPropsWithoutRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export const metadata: Metadata = {
  title: "Provisioning API — MSP Pentesting",
  description:
    "Programmatic /api/v1 for partners to provision org trees, mint scoped keys, launch pentests, and pull results.",
};

function getDoc() {
  const fullPath = path.join(process.cwd(), "src/content/docs/api-v1.md");
  return fs.readFileSync(fullPath, "utf8");
}

// Dark-theme markdown renderers (no typography plugin in this project).
const components = {
  h1: (p: ComponentPropsWithoutRef<"h1">) => (
    <h1 className="mt-10 mb-4 text-3xl font-bold text-white" {...p} />
  ),
  h2: (p: ComponentPropsWithoutRef<"h2">) => (
    <h2
      className="mt-10 mb-3 border-b border-[#22364a] pb-2 text-2xl font-semibold text-white"
      {...p}
    />
  ),
  h3: (p: ComponentPropsWithoutRef<"h3">) => (
    <h3 className="mt-6 mb-2 text-lg font-semibold text-[#8fc0ff]" {...p} />
  ),
  p: (p: ComponentPropsWithoutRef<"p">) => (
    <p className="my-4 leading-7 text-[var(--text-muted)]" {...p} />
  ),
  ul: (p: ComponentPropsWithoutRef<"ul">) => (
    <ul
      className="my-4 list-disc space-y-1 pl-6 text-[var(--text-muted)]"
      {...p}
    />
  ),
  ol: (p: ComponentPropsWithoutRef<"ol">) => (
    <ol
      className="my-4 list-decimal space-y-1 pl-6 text-[var(--text-muted)]"
      {...p}
    />
  ),
  li: (p: ComponentPropsWithoutRef<"li">) => (
    <li className="leading-7" {...p} />
  ),
  a: (p: ComponentPropsWithoutRef<"a">) => (
    <a className="text-[var(--primary)] underline hover:opacity-80" {...p} />
  ),
  hr: () => <hr className="my-8 border-[#22364a]" />,
  code: ({ className, ...rest }: ComponentPropsWithoutRef<"code">) => {
    const isBlock = (className ?? "").includes("language-");
    if (isBlock) {
      return <code className={`${className ?? ""} text-sm`} {...rest} />;
    }
    return (
      <code
        className="rounded bg-[#12202f] px-1.5 py-0.5 text-[0.85em] text-[#8fc0ff]"
        {...rest}
      />
    );
  },
  pre: (p: ComponentPropsWithoutRef<"pre">) => (
    <pre
      className="my-5 overflow-x-auto rounded-lg border border-[#22364a] bg-[#0d1826] p-4 text-[#cfe3ff]"
      {...p}
    />
  ),
  table: (p: ComponentPropsWithoutRef<"table">) => (
    <div className="my-6 overflow-x-auto">
      <table className="w-full border-collapse text-sm" {...p} />
    </div>
  ),
  th: (p: ComponentPropsWithoutRef<"th">) => (
    <th
      className="border border-[#22364a] bg-[#12202f] px-3 py-2 text-left font-semibold text-white"
      {...p}
    />
  ),
  td: (p: ComponentPropsWithoutRef<"td">) => (
    <td
      className="border border-[#22364a] px-3 py-2 align-top text-[var(--text-muted)]"
      {...p}
    />
  ),
};

export default function ApiDocsPage() {
  const content = getDoc();

  return (
    <main className="min-h-screen bg-[#0a141f] text-white">
      <div className="mx-auto max-w-4xl px-5 py-12">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#4590e2] bg-[#12202f] px-3 py-1 text-xs font-medium text-[#8fc0ff]">
          Beta · early access
        </div>
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
          {content}
        </ReactMarkdown>
        <p className="mt-12 border-t border-[#22364a] pt-6 text-sm text-[var(--text-muted)]">
          Want partner access or an API key?{" "}
          <a
            href="/support"
            className="text-[var(--primary)] underline hover:opacity-80"
          >
            Get in touch
          </a>
          .
        </p>
      </div>
    </main>
  );
}
