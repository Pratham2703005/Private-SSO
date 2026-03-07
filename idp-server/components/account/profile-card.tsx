import type { UserAccount } from "@/types/database";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { getDisplayName } from "@/utils/account-helpers";
import { Button } from "@/components/ui/button";

interface ProfileCardProps {
  account: UserAccount;
  onEditProfile?: () => void;
}

export function ProfileCard({ account, onEditProfile }: ProfileCardProps) {
  const displayName = getDisplayName(account.name, account.email);

  return (
    <div className="flex items-start gap-6">
      <ProfileAvatar
        name={account.name}
        email={account.email}
        size="xl"
        showBorder={true}
      />

      <div className="flex-1">
        <h2 className="text-3xl font-bold text-gray-900">{displayName}</h2>
        <p className="text-gray-600 mt-1">{account.email}</p>

        {onEditProfile && (
          <Button
            variant="outline"
            size="md"
            onClick={onEditProfile}
            className="mt-4"
          >
            Edit profile
          </Button>
        )}
      </div>
    </div>
  );
}
