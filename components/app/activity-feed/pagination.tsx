"use client";

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { useMemo } from "react"; // Import useMemo

const PAGINATION_SIBLING_COUNT = 1; // How many pages to show on each side of the current page

export function ActivityFeedPagination({
  totalPages,
  currentPage,
  onPageChange,
}: {
  totalPages: number;
  currentPage: number;
  onPageChange: (pageNumber: number) => void;
}) {
  const handlePageChange = (pageNumber: number) => {
    onPageChange(pageNumber);
  };

  // --- Pagination Logic ---
  const paginationRange = useMemo(() => {
    const totalPageNumbers = PAGINATION_SIBLING_COUNT + 5; // siblings + first + last + current + 2*ellipsis

    // Case 1: Number of pages is less than the page numbers we want to show
    if (totalPageNumbers >= totalPages) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const leftSiblingIndex = Math.max(
      currentPage - PAGINATION_SIBLING_COUNT,
      1,
    );
    const rightSiblingIndex = Math.min(
      currentPage + PAGINATION_SIBLING_COUNT,
      totalPages,
    );

    // We do not show dots just when there is just one page number to be inserted between the extremes of sibling and the limits i.e 1 and totalPages.
    const shouldShowLeftDots = leftSiblingIndex > 2;
    const shouldShowRightDots = rightSiblingIndex < totalPages - 1;

    const firstPageIndex = 1;
    const lastPageIndex = totalPages;

    // Case 2: No left dots to show, but rights dots to be shown
    if (!shouldShowLeftDots && shouldShowRightDots) {
      const leftItemCount = 3 + 2 * PAGINATION_SIBLING_COUNT;
      const leftRange = Array.from({ length: leftItemCount }, (_, i) => i + 1);
      return [...leftRange, "...", totalPages];
    }
    // Case 3: No right dots to show, but left dots to be shown
    if (shouldShowLeftDots && !shouldShowRightDots) {
      const rightItemCount = 3 + 2 * PAGINATION_SIBLING_COUNT;
      const rightRange = Array.from(
        { length: rightItemCount },
        (_, i) => totalPages - rightItemCount + i + 1,
      );
      return [firstPageIndex, "...", ...rightRange];
    }
    // Case 4: Both left and right dots to be shown
    if (shouldShowLeftDots && shouldShowRightDots) {
      const middleRange = Array.from(
        { length: rightSiblingIndex - leftSiblingIndex + 1 },
        (_, i) => leftSiblingIndex + i,
      );
      return [firstPageIndex, "...", ...middleRange, "...", lastPageIndex];
    }

    // Default case (should not happen with above logic, but for safety)
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }, [currentPage, totalPages]);
  // --- End Pagination Logic ---

  return (
    <div className="debug mt-6 flex items-center justify-between">
      <Pagination className="debug">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href="#"
              onClick={(e) => {
                e.preventDefault();
                handlePageChange(currentPage - 1);
              }}
              aria-disabled={currentPage === 1}
              tabIndex={currentPage === 1 ? -1 : undefined}
              className={
                currentPage === 1 ? "pointer-events-none opacity-50" : undefined
              }
            />
          </PaginationItem>

          {/* Render pagination items based on calculated range */}
          {paginationRange.map((pageNumber, index) => {
            // If the pageItem is a DOTS character, render the PaginationEllipsis component
            if (pageNumber === "...") {
              return (
                <PaginationItem key={`ellipsis-${index}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              );
            }

            // Render a PaginationLink component
            return (
              <PaginationItem key={pageNumber}>
                <PaginationLink
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    handlePageChange(pageNumber as number);
                  }}
                  isActive={currentPage === pageNumber}
                  aria-current={currentPage === pageNumber ? "page" : undefined}
                >
                  {pageNumber}
                </PaginationLink>
              </PaginationItem>
            );
          })}
          {/* End Render pagination items */}

          <PaginationItem>
            <PaginationNext
              href="#"
              onClick={(e) => {
                e.preventDefault();
                handlePageChange(currentPage + 1);
              }}
              aria-disabled={currentPage === totalPages}
              tabIndex={currentPage === totalPages ? -1 : undefined}
              className={
                currentPage === totalPages
                  ? "pointer-events-none opacity-50"
                  : undefined
              }
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
