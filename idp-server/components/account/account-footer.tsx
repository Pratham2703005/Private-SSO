import Link from "next/link";

interface FooterLink {
  label: string;
  href: string;
}

interface AccountFooterProps {
  links: readonly FooterLink[];
}

export function AccountFooter({ links }: AccountFooterProps) {
  return (
    <footer className="border-t border-gray-200 bg-white px-6 py-6 mt-auto">
      <div className="max-w-7xl mx-auto flex justify-center gap-6 text-sm text-gray-600">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="hover:text-gray-900 transition-colors"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </footer>
  );
}
