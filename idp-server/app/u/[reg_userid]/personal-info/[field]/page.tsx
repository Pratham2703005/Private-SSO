import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ReauthWall } from "@/components/account/reauth-wall";
import { PERSONAL_INFO_FIELD_LABELS } from "@/constants/personal-info";
import { getPersonalInfoValuesBySlug, isPersonalInfoFieldSlug } from "@/lib/personal-info";
import { getMaskedEmailForReauth, resolvePersonalInfoAccess } from "../access-resolver";

interface PageProps {
  params: Promise<{ reg_userid: string; field: string }>;
}

export default async function PersonalInfoDetailPage({ params }: PageProps) {
  const { reg_userid, field } = await params;

  if (!isPersonalInfoFieldSlug(field)) {
    notFound();
  }

  const returnTo = `/u/${reg_userid}/personal-info/${field}`;
  const resolution = await resolvePersonalInfoAccess(reg_userid, returnTo);

  if (resolution.status === "not-found") {
    notFound();
  }

  if (resolution.status === "redirect") {
    redirect(resolution.destination);
  }

  if (resolution.status === "reauth") {
    return (
      <ReauthWall
        name={resolution.account.name}
        maskedEmail={getMaskedEmailForReauth(resolution.account)}
        email={resolution.account.email}
        initial={resolution.account.name?.charAt(0)?.toUpperCase() || "?"}
        returnTo={resolution.returnTo}
      />
    );
  }

  const label = PERSONAL_INFO_FIELD_LABELS[field];
  const values = getPersonalInfoValuesBySlug(resolution.account, field);

  return (
    <div className="max-w-4xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">{label}</h1>
        <p className="text-gray-600">Review and update your {label.toLowerCase()} settings.</p>
      </div>

      <div className="rounded-lg bg-white p-6 shadow-sm">
        <h2 className="text-sm font-medium text-gray-600">Current value</h2>
        <div className="mt-3 space-y-1">
          {values.map((value, index) => (
            <p
              key={`${field}-${index}`}
              className={value === "Not set" ? "text-gray-400" : "text-gray-900"}
            >
              {value}
            </p>
          ))}
        </div>
      </div>

      <div>
        <Link
          href={`/u/${reg_userid}/personal-info`}
          className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Back to personal info
        </Link>
      </div>
    </div>
  );
}
