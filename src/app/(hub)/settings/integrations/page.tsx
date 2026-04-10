import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Plug2, ChevronRight } from "lucide-react";

export default async function IntegrationsSettingsPage() {
  const session = await auth();
  if (!session) return null;

  const [connectedAccounts, repoStats] = await Promise.all([
    prisma.connectedAccount.findMany({ where: { userId: session.user.id } }),
    prisma.repo.aggregate({
      _count: { id: true },
      where: { connected: true },
    }),
  ]);

  const isGitHubConnected = connectedAccounts.some((a) => a.provider === "github");
  const isAwsConnected = connectedAccounts.some((a) => a.provider === "aws");
  const connectedRepoCount = repoStats._count.id;

  const awsAccount = connectedAccounts.find((a) => a.provider === "aws");
  const awsRegion = awsAccount?.scope ?? null;
  const awsLinkedRepoCount = await prisma.repoAwsLink
    .findMany({ distinct: ["repoId"] })
    .then((links) => links.length);

  const integrations = [
    {
      id: "github",
      name: "GitHub",
      description:
        "Connect repositories to your workspace. Sync issues, track progress, and tie team members to their GitHub identities.",
      href: "/integrations/github",
      icon: (
        <svg viewBox="0 0 16 16" fill="currentColor" className="w-5 h-5 text-[#D0D0D0]">
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
        </svg>
      ),
      stats: [
        { label: "Active repos", value: connectedRepoCount },
        { label: "Your GitHub", value: isGitHubConnected ? "Linked" : "Not linked" },
      ],
      statusLabel: connectedRepoCount > 0 ? "Active" : "Not set up",
      statusColor: connectedRepoCount > 0 ? "green" : "gray",
      action: null as { label: string; href: string; danger: boolean } | null,
    },
    {
      id: "aws",
      name: "Amazon Web Services",
      description:
        "Connect your AWS account to link projects to their deployed infrastructure — EC2 instances, Amplify apps, CloudWatch logs, Route 53 DNS, and more.",
      href: "/integrations/aws",
      icon: (
        <svg viewBox="0 0 80 48" fill="none" className="w-6 h-4" aria-label="AWS">
          <path
            d="M22.4 19.2c0 .8.1 1.4.2 1.9.2.4.4.9.7 1.4.1.2.2.4.2.5 0 .2-.1.4-.4.7l-1.3.9c-.2.1-.4.2-.5.2-.2 0-.4-.1-.6-.3-.3-.3-.5-.6-.7-1-.2-.4-.4-.8-.6-1.4-1.4 1.7-3.2 2.5-5.3 2.5-1.5 0-2.7-.4-3.6-1.3-.9-.9-1.3-2-1.3-3.4 0-1.5.5-2.7 1.6-3.7 1.1-.9 2.5-1.4 4.3-1.4.6 0 1.2.1 1.8.2.7.1 1.3.3 2 .5v-1.3c0-1.3-.3-2.3-.8-2.8-.6-.5-1.5-.8-2.9-.8-.6 0-1.3.1-1.9.3-.7.2-1.3.4-1.9.7-.3.1-.5.2-.6.2-.2 0-.3-.2-.3-.5V11c0-.3 0-.5.1-.6.1-.1.3-.3.6-.4.6-.3 1.3-.6 2.2-.8.9-.2 1.8-.3 2.8-.3 2.1 0 3.7.5 4.6 1.5.9 1 1.4 2.5 1.4 4.5v5.8zm-7.3 2.7c.6 0 1.2-.1 1.8-.4.6-.3 1.1-.7 1.5-1.4.3-.4.4-.9.5-1.4.1-.5.1-1 .1-1.7v-.8c-.5-.1-1-.2-1.6-.3-.5-.1-1-.1-1.5-.1-1.1 0-1.9.2-2.4.7-.5.4-.8 1.1-.8 1.9 0 .8.2 1.4.6 1.8.4.4 1 .7 1.8.7zm12.8 1.7c-.3 0-.5-.1-.7-.2-.1-.1-.3-.4-.4-.8l-4-13.2c-.1-.4-.2-.7-.2-.8 0-.3.2-.5.5-.5h2c.3 0 .6.1.7.2.2.1.3.4.4.8l2.9 11.3 2.7-11.3c.1-.4.2-.7.4-.8.2-.1.4-.2.8-.2h1.6c.3 0 .6.1.8.2.2.1.3.4.4.8l2.7 11.4 3-11.4c.1-.4.3-.7.4-.8.2-.1.4-.2.7-.2h1.9c.3 0 .5.2.5.5 0 .1 0 .2-.1.4 0 .2-.1.3-.2.5l-4.1 13.2c-.1.4-.3.7-.4.8-.2.1-.4.2-.7.2h-1.7c-.3 0-.6-.1-.8-.2-.2-.1-.3-.4-.4-.8L34 12.9l-2.6 10.7c-.1.4-.2.7-.4.8-.2.1-.4.2-.8.2h-2.3zM53 24c-.7 0-1.4-.1-2.1-.3-.7-.2-1.2-.4-1.6-.6-.2-.1-.4-.3-.4-.5V21c0-.3.1-.5.4-.5.1 0 .2 0 .3.1l.5.2c.6.3 1.2.5 1.9.6.7.1 1.3.2 1.9.2 1 0 1.8-.2 2.3-.5.5-.4.8-.9.8-1.5 0-.4-.1-.8-.4-1.1-.3-.3-.9-.6-1.7-.9l-2.4-.8c-1.2-.4-2.1-.9-2.7-1.7-.6-.7-.9-1.6-.9-2.5 0-.7.2-1.4.5-1.9.3-.6.8-1.1 1.4-1.5.6-.4 1.2-.7 2-.9.7-.2 1.5-.3 2.3-.3.4 0 .8 0 1.3.1.4.1.8.2 1.2.3.4.1.7.2.9.4.3.1.5.3.6.4.1.2.2.4.2.6v1.5c0 .3-.1.5-.4.5-.1 0-.3-.1-.6-.2-1-.5-2.1-.7-3.3-.7-.9 0-1.7.2-2.1.5-.5.3-.7.8-.7 1.4 0 .4.2.8.5 1.1.3.3.9.6 1.9.9l2.3.8c1.2.4 2 .9 2.6 1.6.6.7.8 1.5.8 2.4 0 .7-.1 1.4-.4 2-.3.6-.7 1.1-1.3 1.5-.6.4-1.2.7-2 .9-.8.2-1.7.3-2.6.3z"
            fill="#FF9900"
          />
          <path
            d="M52.5 32.1c-7.5 5.5-18.3 8.5-27.6 8.5-13.1 0-24.8-4.8-33.7-12.8-.7-.6-.1-1.5.8-1 9.6 5.6 21.4 8.9 33.6 8.9 8.2 0 17.3-1.7 25.6-5.2 1.3-.5 2.3.8 1.3 1.6z"
            fill="#FF9900"
          />
          <path
            d="M55.7 28.5c-.9-1.2-6.2-.6-8.6-.3-.7.1-.8-.5-.2-.9 4.2-2.9 11.1-2.1 11.9-1.1.8 1-.2 7.9-4.1 11.2-.6.5-1.2.2-.9-.4.9-2.1 2.9-7.3 1.9-8.5z"
            fill="#FF9900"
          />
        </svg>
      ),
      stats: [
        {
          label: "Status",
          value: isAwsConnected ? `Connected · ${awsRegion}` : "Not connected",
        },
        { label: "Linked repos", value: awsLinkedRepoCount },
      ],
      statusLabel: isAwsConnected ? "Connected" : "Not connected",
      statusColor: isAwsConnected ? "green" : "gray",
      action: null as { label: string; href: string; danger: boolean } | null,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Section header */}
      <div>
        <h2 className="text-lg font-bold text-[#F0F0F0] flex items-center gap-2.5">
          <Plug2 size={17} className="text-[#F7941D]" />
          Integrations
        </h2>
        <p className="text-sm text-[#505050] mt-1">
          Connect external services to bring your full tech stack into SmartHub.
        </p>
      </div>

      {/* Integration list */}
      <div className="rounded-xl border border-[rgba(255,255,255,0.06)] overflow-hidden divide-y divide-[rgba(255,255,255,0.04)]">
        {integrations.map((integration) => {
          const isClickable = !!integration.href;
          const card = (
            <div
              className={`group flex items-center gap-4 px-5 py-4 bg-[#111111] transition-colors ${isClickable
                  ? "hover:bg-[#141414] cursor-pointer"
                  : "cursor-default"
                }`}
            >
              {/* Icon */}
              <div className="w-9 h-9 rounded-xl bg-[#1A1A1A] flex items-center justify-center flex-shrink-0">
                {integration.icon}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-[#D0D0D0]">
                    {integration.name}
                  </span>
                  <StatusBadge
                    color={integration.statusColor}
                    label={integration.statusLabel}
                  />
                </div>
                <p className="text-xs text-[#505050] mt-0.5 leading-relaxed line-clamp-1">
                  {integration.description}
                </p>
              </div>

              {/* Stats */}
              <div className="hidden sm:flex items-center gap-5 flex-shrink-0">
                {integration.stats.map((stat) => (
                  <div key={stat.label} className="text-right">
                    <div className="text-[10px] text-[#404040] uppercase tracking-wider">
                      {stat.label}
                    </div>
                    <div className="text-sm font-semibold text-[#C0C0C0]">{stat.value}</div>
                  </div>
                ))}
              </div>

              {/* Action or chevron */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {integration.action ? (
                  <a
                    href={integration.action.href}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${integration.action.danger
                        ? "text-[#EF4444] border border-[rgba(239,68,68,0.2)] hover:bg-[rgba(239,68,68,0.08)]"
                        : "text-[#9A9A9A] border border-[rgba(255,255,255,0.08)] hover:text-[#F0F0F0]"
                      }`}
                  >
                    {integration.action.label}
                  </a>
                ) : isClickable ? (
                  <ChevronRight
                    size={15}
                    className="text-[#303030] group-hover:text-[#F7941D] transition-colors"
                  />
                ) : null}
              </div>
            </div>
          );

          return isClickable ? (
            <Link key={integration.id} href={integration.href!}>
              {card}
            </Link>
          ) : (
            <div key={integration.id}>{card}</div>
          );
        })}
      </div>

    </div>
  );
}

function StatusBadge({ color, label }: { color: string; label: string }) {
  const styles: Record<string, string> = {
    green: "bg-[rgba(34,197,94,0.1)] text-[#22C55E]",
    gray: "bg-[rgba(255,255,255,0.05)] text-[#505050]",
    orange: "bg-[rgba(247,148,29,0.1)] text-[#F7941D]",
  };
  return (
    <span
      className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider ${styles[color] ?? styles.gray
        }`}
    >
      {label}
    </span>
  );
}
