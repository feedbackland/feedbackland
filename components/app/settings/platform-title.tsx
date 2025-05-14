"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useOrg } from "@/hooks/use-org";
import { useUpdateOrg } from "@/hooks/use-update-org";
import { useEffect, useState } from "react";

export function PlatformTitle() {
  const {
    query: { data },
  } = useOrg();

  const updateOrg = useUpdateOrg();

  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState("");

  useEffect(() => {
    if (data?.platformTitle) {
      setValue(data.platformTitle);
    }
  }, [data]);

  const handleOnSave = () => {
    updateOrg.mutate({ platformTitle: value });
  };

  return (
    <div className="border-b-border relative border py-5">
      {isEditing ? (
        <>
          <Button
            className="top-2 right-2"
            size="sm"
            variant="link"
            onClick={() => setIsEditing(false)}
          >
            Cancel
          </Button>
          <Input
            type="text"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
            }}
          />
          <Button onClick={handleOnSave} loading={updateOrg.isPending}>
            Save
          </Button>
        </>
      ) : (
        <>
          <Button
            className="top-2 right-2"
            size="sm"
            variant="link"
            onClick={() => setIsEditing(true)}
          >
            Edit
          </Button>
          <div className="flex flex-col items-stretch space-y-3">
            <Label>Platform title</Label>
            <div className="text-primary text-sm">{value}</div>
          </div>
        </>
      )}
    </div>
  );
}
