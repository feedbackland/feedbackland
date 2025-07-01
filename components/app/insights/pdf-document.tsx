import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { InsightData as InsightType } from "@/lib/typings";
import { getPriorityColor, getPriorityLabel } from "@/lib/utils";

const styles = StyleSheet.create({
  page: {
    flexDirection: "column",
    backgroundColor: "#ffffff",
    padding: 30,
  },
  section: {
    margin: 10,
    padding: 10,
    flexGrow: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "left",
    marginBottom: 8,
  },
  generatedOn: {
    fontSize: 12,
    color: "#666",
    textAlign: "left",
    marginBottom: 25,
  },
  insightTitle: {
    fontSize: 14,
    marginBottom: 7,
    fontWeight: "bold",
  },
  insightDescription: {
    fontSize: 12,
    lineHeight: 1.3,
    marginBottom: 6,
  },
  insightPriority: {
    fontSize: 10,
    color: "#666",
  },
});

export const InsightsPdfDocument = ({
  insights,
}: {
  insights: InsightType[];
}) => {
  if (insights && insights.length > 0) {
    return (
      <Document>
        <Page size="A4" style={styles.page}>
          <View style={styles.section}>
            <Text style={styles.title}>Roadmap</Text>
            <Text style={styles.generatedOn}>
              Generated on{" "}
              {new Date(insights?.[0]?.createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </Text>
            {insights.map((insight) => (
              <View key={insight.id} style={{ marginBottom: 22 }}>
                <Text style={styles.insightTitle}>{insight.title}</Text>
                <Text style={styles.insightDescription}>
                  {insight.description}
                </Text>
                <Text
                  style={{
                    ...styles.insightPriority,
                    color: getPriorityColor(Number(insight.priority)),
                  }}
                >
                  {getPriorityLabel(Number(insight.priority))}
                </Text>
              </View>
            ))}
          </View>
        </Page>
      </Document>
    );
  }

  return null;
};
