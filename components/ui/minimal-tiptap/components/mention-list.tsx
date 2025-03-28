import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  forwardRef,
  useImperativeHandle,
} from "react";
import { SuggestionProps } from "@tiptap/suggestion";
import { useTRPC } from "@/providers/trpc-client";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";

interface MentionListRef {
  onKeyDown: ({ event }: { event: KeyboardEvent }) => boolean;
}

interface MentionItem {
  id: string;
  name: string;
}

const MentionList = forwardRef<MentionListRef, SuggestionProps<MentionItem>>(
  (props, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [items, setItems] = useState<MentionItem[]>([]);
    const listRef = useRef<HTMLDivElement>(null);
    const trpc = useTRPC();

    const { data, isLoading } = useQuery(
      trpc.getMentionableUsers.queryOptions({
        searchValue: props.query,
      }),
    );

    useEffect(() => {
      if (data) {
        setItems(data);
        setSelectedIndex(0);
      }
    }, [data]);

    const selectItem = useCallback(
      (index: number) => {
        const item = items[index];

        if (item) {
          props.command({ id: item.id, label: item.name });
        }
      },
      [items, props],
    );

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }: { event: KeyboardEvent }): boolean => {
        if (event.key === "ArrowUp") {
          setSelectedIndex((selectedIndex + items.length - 1) % items.length);
          return true;
        }

        if (event.key === "ArrowDown" || event.key === "Tab") {
          setSelectedIndex((selectedIndex + 1) % items.length);
          return true;
        }

        if (event.key === "Enter") {
          selectItem(selectedIndex);
          return true;
        }

        return false;
      },
    }));

    // Scroll selected item into view
    useEffect(() => {
      if (listRef.current && items.length > 0) {
        const selectedElement = listRef.current.children[
          selectedIndex
        ] as HTMLElement;

        if (selectedElement) {
          selectedElement.scrollIntoView?.({
            block: "nearest",
            inline: "nearest",
          });
        }
      }
    }, [selectedIndex, items]);

    if (isLoading && items.length === 0) {
      return (
        <div className="z-50 flex items-center justify-center p-2">
          <Spinner size="small" />
        </div>
      );
    }

    if (!isLoading && items.length === 0) {
      return null; // Don't show list if no items and not loading
    }

    return (
      <div
        ref={listRef}
        className="bg-background border-border z-50 max-h-60 w-44 space-y-1 overflow-y-auto rounded-md border p-2 shadow-xs"
      >
        {items.map((item, index) => (
          <Button
            key={item.id}
            size="sm"
            variant={index === selectedIndex ? "secondary" : "ghost"}
            className={cn("w-full justify-start shadow-none")}
            onClick={() => selectItem(index)}
          >
            {item.name}
          </Button>
        ))}
      </div>
    );
  },
);

MentionList.displayName = "MentionList";

export default MentionList;
