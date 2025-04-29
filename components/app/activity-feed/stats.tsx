import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useActivityFeedMetaData } from "@/hooks/use-activity-feed-meta-data";

export function Stats() {
  const {
    query: { data: metaData },
  } = useActivityFeedMetaData({ enabled: true });

  const statsData = [
    {
      title: "Feature requests",
      value: metaData?.totalFeatureRequestPostCount,
      newValue: metaData?.unseenFeatureRequestPostCount,
    },
    {
      title: "Bug reports",
      value: metaData?.totalBugReportPostCount,
      newValue: metaData?.unseenBugReportPostCount,
    },
    {
      title: "General feedback",
      value: metaData?.totalGeneralFeedbackPostCount,
      newValue: metaData?.unseenGeneralFeedbackPostCount,
    },
    {
      title: "Comments",
      value: metaData?.totalCommentCount,
      newValue: metaData?.unseenCommentCount,
    },
  ];

  return (
    <div className="mt-3 mb-3 grid grid-cols-4 gap-3">
      {statsData.map((stat, index) => (
        <Card
          key={index}
          className="border-border hover:border-primary flex cursor-pointer flex-col justify-between gap-0 rounded p-3 shadow-none"
        >
          <CardHeader className="text-muted-foreground p-0 text-sm font-medium">
            {stat.title}
          </CardHeader>
          <CardContent className="flex items-baseline gap-1 p-0">
            <span className="text-xl font-bold">{stat.value}</span>
            {stat.newValue !== undefined && stat.newValue > 0 && (
              <span className="text-muted-foreground text-xs">
                ({stat.newValue} new)
              </span>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
