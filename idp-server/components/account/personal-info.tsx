"use client";

import { UserAccount } from "@/types/database";
import { ProfileAvatar } from "@/components/ui";
import Link from "next/link";
import { buildPersonalInfoDisplayItems } from "@/lib/personal-info";

interface PersonalInfoProps {
  account: UserAccount;
  regUserId: string;
}

export function PersonalInfo({ account, regUserId }: PersonalInfoProps) {
  const items = buildPersonalInfoDisplayItems(account);

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-4xl font-medium text-gray-800 mb-4">Personal info</h1> 
      <div className="rounded-4xl bg-white shadow-sm">
        <div className="py-4">
          {items.map((item) => (
            <Link
              href={`/u/${regUserId}/personal-info/${item.slug}`}
              key={item.slug}
              className="py-6 px-12 flex justify-between items-start gap-4 border-b border-gray-200 hover:bg-gray-200"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="font-semibold text-gray-900">{item.label}</h3>
                    {item.values.map((value, index) => (
                      <p
                        key={`${item.slug}-${index}`}
                        className={
                          value === "Not set" ? "text-sm text-gray-400" : "text-sm text-gray-700"
                        }
                      >
                        {value}
                      </p>
                    ))}
                  </div>
                  {item.slug === "profile-picture" && (
                    <ProfileAvatar
                      name={account.name}
                      email={account.email}
                      size="lg"
                      showBorder={true}
                    />
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
