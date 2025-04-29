import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useActivityFeedMetaData } from "@/hooks/use-activity-feed-meta-data";

export function ActivityFeedStats() {
  const {
    query: { data: metaData },
  } = useActivityFeedMetaData({ enabled: true });

  const statsData = [
    {
      title: "Feature requests",
      totalCount: metaData?.totalFeatureRequestPostCount,
      newCount: metaData?.unseenFeatureRequestPostCount,
    },
    {
      title: "Bug reports",
      totalCount: metaData?.totalBugReportPostCount,
      newCount: metaData?.unseenBugReportPostCount,
    },
    {
      title: "General feedback",
      totalCount: metaData?.totalGeneralFeedbackPostCount,
      newCount: metaData?.unseenGeneralFeedbackPostCount,
    },
    {
      title: "Comments",
      totalCount: metaData?.totalCommentCount,
      newCount: metaData?.unseenCommentCount,
    },
  ];

  const handleOnClick = (title: string) => {};

  return (
    <div className="mt-3 mb-3 grid grid-cols-4 gap-3">
      {statsData.map((stat, index) => (
        <Card
          key={index}
          className="border-border hover:border-primary flex cursor-pointer flex-col justify-between gap-0 rounded p-3 shadow-none"
          onClick={() => {
            handleOnClick(stat.title);
          }}
        >
          <CardHeader className="text-muted-foreground p-0 text-sm font-medium">
            {stat.title}
          </CardHeader>
          <CardContent className="flex items-baseline gap-1 p-0">
            <span className="text-xl font-bold">{stat.totalCount}</span>
            {stat.newCount !== undefined && stat.newCount > 0 && (
              <span className="text-muted-foreground text-xs">
                ({stat.newCount} new)
              </span>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
