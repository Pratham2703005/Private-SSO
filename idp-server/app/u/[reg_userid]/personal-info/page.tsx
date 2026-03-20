import { PersonalInfo } from "@/components/account/personal-info";
import { notFound, redirect } from "next/navigation";
import { ReauthWall } from "@/components/account/reauth-wall";
import { getMaskedEmailForReauth, resolvePersonalInfoAccess } from "./access-resolver";

export const metadata = {
  title: "Personal Info — My Accounts SSO",
  description: "Manage your personal information",
};

interface PageProps {
  params: Promise<{ reg_userid: string }>;
}

export default async function PersonalInfoPage({ params }: PageProps) {
  const { reg_userid } = await params;
  const resolution = await resolvePersonalInfoAccess(
    reg_userid,
    `/u/${reg_userid}/personal-info`,
  );

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
        imageUrl={resolution.account.profile_image_url}
        returnTo={resolution.returnTo}
      />
    );
  }

  return (
    <PersonalInfo account={resolution.account} regUserId={reg_userid} />
  );
}
