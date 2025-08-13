"use client";

import { useState } from "react";
import { pdf } from "@react-pdf/renderer";
import { InsightsPdfDocument } from "./pdf-document";
import { useAllInsights } from "@/hooks/use-all-insights";
import { Button } from "@/components/ui/button";
import { DownloadIcon } from "@radix-ui/react-icons";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function InsightsDownloadButton() {
  const [isProcessing, setIsProcessing] = useState(false);

  const downloadBlob = ({
    blob,
    filename,
  }: {
    blob: Blob;
    filename: string;
  }) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const {
    query: { refetch },
  } = useAllInsights({ enabled: false });

  const handleDownload = async () => {
    try {
      setIsProcessing(true);
      const { data } = await refetch();
      const docElement = <InsightsPdfDocument insights={data || []} />;
      const blob = await pdf(docElement).toBlob();
      const date = new Date(
        data?.[0].createdAt || Date.now(),
      ).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      const filename = `Feedbackland AI Roadmap - ${date}.pdf`;
      downloadBlob({ blob, filename });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="icon"
          variant="outline"
          onClick={handleDownload}
          loading={isProcessing}
        >
          <DownloadIcon className="size-4!" />
          <span className="sr-only">Download as PDF</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>Download as PDF</TooltipContent>
    </Tooltip>
  );
}
