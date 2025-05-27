import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { InsightData as InsightType } from "@/lib/typings"; // Use the new InsightData type

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
    textAlign: "center",
    marginBottom: 20,
  },
  insightTitle: {
    fontSize: 18,
    marginBottom: 5,
    fontWeight: "bold",
  },
  insightDescription: {
    fontSize: 12,
    marginBottom: 10,
  },
  insightCategory: {
    fontSize: 10,
    color: "#888",
    marginBottom: 5,
  },
  insightMeta: {
    fontSize: 10,
    color: "#666",
    marginBottom: 10,
  },
});

interface InsightsPdfDocumentProps {
  insights: InsightType[];
}

export const InsightsPdfDocument: React.FC<InsightsPdfDocumentProps> = ({
  insights,
}) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.section}>
        <Text style={styles.title}>AI Insights Report</Text>
        {insights.map((insight, index) => (
          <View key={insight.id} style={{ marginBottom: 15 }}>
            {" "}
            {/* No cast needed */}
            <Text style={styles.insightTitle}>{insight.title}</Text>
            <Text style={styles.insightDescription}>{insight.description}</Text>
            {insight.category && (
              <Text style={styles.insightCategory}>
                Category: {insight.category}
              </Text>
            )}
            <Text style={styles.insightMeta}>
              Upvotes: {insight.upvotes} | Comments: {insight.commentCount} |
              Priority: {insight.priority}
            </Text>
            <Text style={styles.insightMeta}>
              Generated: {new Date(insight.createdAt).toLocaleDateString()}{" "}
            </Text>
          </View>
        ))}
      </View>
    </Page>
  </Document>
);
