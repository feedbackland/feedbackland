import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { InsightData as InsightType } from "@/lib/typings"; // Use the new InsightData type
import { getPriorityLabel } from "@/lib/utils";

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
    textAlign: "center",
    marginBottom: 10,
  },
  generatedOn: {
    fontSize: 12,
    color: "#666",
    textAlign: "center",
    marginBottom: 25,
  },
  insightTitle: {
    fontSize: 14,
    marginBottom: 5,
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

interface InsightsPdfDocumentProps {
  insights: InsightType[];
}

export const InsightsPdfDocument: React.FC<InsightsPdfDocumentProps> = ({
  insights,
}) => {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.section}>
          <Text style={styles.title}>AI Insights Report</Text>
          <Text style={styles.generatedOn}>
            Generated on{" "}
            {new Date(insights?.[0].createdAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </Text>
          {insights.map((insight, index) => (
            <View key={insight.id} style={{ marginBottom: 20 }}>
              <Text style={styles.insightTitle}>
                {index + 1}
                {". "}
                {insight.title}
              </Text>
              <Text style={styles.insightDescription}>
                {insight.description}
              </Text>
              <Text style={styles.insightPriority}>
                {getPriorityLabel(Number(insight.priority))}
              </Text>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
};
