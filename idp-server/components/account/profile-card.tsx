import { User } from "@/types/account";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { getDisplayName } from "@/utils/account-helpers";
import { Button } from "@/components/ui/button";

interface ProfileCardProps {
  user: User;
  onEditProfile?: () => void;
}

export function ProfileCard({ user, onEditProfile }: ProfileCardProps) {
  const displayName = getDisplayName(user.name, user.email);

  return (
    <div className="flex items-start gap-6">
      <ProfileAvatar
        name={user.name}
        email={user.email}
        size="xl"
        showBorder={true}
      />

      <div className="flex-1">
        <h2 className="text-3xl font-bold text-gray-900">{displayName}</h2>
        <p className="text-gray-600 mt-1">{user.email}</p>

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
