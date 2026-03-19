import { notFound, redirect } from "next/navigation";
import { ReauthWall } from "@/components/account/reauth-wall";
import { ProfileFieldEditor } from "@/components/account/profile-field-editor";
import { isPersonalInfoFieldSlug } from "@/lib/personal-info";
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

  return (
    <div>
      <ProfileFieldEditor
        field={field}
        account={resolution.account}
        regUserId={reg_userid}
      />
    </div>
  );
}
