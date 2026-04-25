import { useMemo } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

function FieldSet({ className, ...props }: React.ComponentProps<"fieldset">) {
  return (
    <fieldset
      data-slot="field-set"
      className={cn(
        "fl:flex fl:flex-col fl:gap-6",
        "fl:has-[>[data-slot=checkbox-group]]:gap-3 fl:has-[>[data-slot=radio-group]]:gap-3",
        className
      )}
      {...props}
    />
  );
}

function FieldLegend({
  className,
  variant = "legend",
  ...props
}: React.ComponentProps<"legend"> & { variant?: "legend" | "label" }) {
  return (
    <legend
      data-slot="field-legend"
      data-variant={variant}
      className={cn(
        "fl:mb-3 fl:font-medium",
        "fl:data-[variant=legend]:text-base",
        "fl:data-[variant=label]:text-sm",
        className
      )}
      {...props}
    />
  );
}

function FieldGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-group"
      className={cn(
        "fl:group/field-group fl:@container/field-group fl:flex fl:w-full fl:flex-col fl:gap-7 fl:data-[slot=checkbox-group]:gap-3 fl:[&>[data-slot=field-group]]:gap-4",
        className
      )}
      {...props}
    />
  );
}

const fieldVariants = cva(
  "fl:group/field fl:flex fl:w-full fl:gap-3 fl:data-[invalid=true]:text-destructive",
  {
    variants: {
      orientation: {
        vertical: ["fl:flex-col fl:[&>*]:w-full fl:[&>.sr-only]:w-auto"],
        horizontal: [
          "fl:flex-row fl:items-center",
          "fl:[&>[data-slot=field-label]]:flex-auto",
          "fl:has-[>[data-slot=field-content]]:items-start fl:has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px",
        ],
        responsive: [
          "fl:flex-col fl:[&>*]:w-full fl:[&>.sr-only]:w-auto fl:@md/field-group:flex-row fl:@md/field-group:items-center fl:@md/field-group:[&>*]:w-auto",
          "fl:@md/field-group:[&>[data-slot=field-label]]:flex-auto",
          "fl:@md/field-group:has-[>[data-slot=field-content]]:items-start fl:@md/field-group:has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px",
        ],
      },
    },
    defaultVariants: {
      orientation: "vertical",
    },
  }
);

function Field({
  className,
  orientation = "vertical",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof fieldVariants>) {
  return (
    <div
      role="group"
      data-slot="field"
      data-orientation={orientation}
      className={cn(fieldVariants({ orientation }), className)}
      {...props}
    />
  );
}

function FieldContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-content"
      className={cn(
        "fl:group/field-content fl:flex fl:flex-1 fl:flex-col fl:gap-1.5 fl:leading-snug",
        className
      )}
      {...props}
    />
  );
}

function FieldLabel({
  className,
  ...props
}: React.ComponentProps<typeof Label>) {
  return (
    <Label
      data-slot="field-label"
      className={cn(
        "fl:group/field-label fl:peer/field-label fl:flex fl:w-fit fl:gap-2 fl:leading-snug fl:group-data-[disabled=true]/field:opacity-50",
        "fl:has-[>[data-slot=field]]:w-full fl:has-[>[data-slot=field]]:flex-col fl:has-[>[data-slot=field]]:rounded-md fl:has-[>[data-slot=field]]:border fl:[&>*]:data-[slot=field]:p-4",
        "fl:has-data-[state=checked]:bg-primary/5 fl:has-data-[state=checked]:border-primary fl:dark:has-data-[state=checked]:bg-primary/10",
        className
      )}
      {...props}
    />
  );
}

function FieldTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-label"
      className={cn(
        "fl:flex fl:w-fit fl:items-center fl:gap-2 fl:text-sm fl:leading-snug fl:font-medium fl:group-data-[disabled=true]/field:opacity-50",
        className
      )}
      {...props}
    />
  );
}

function FieldDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="field-description"
      className={cn(
        "fl:text-muted-foreground fl:text-sm fl:leading-normal fl:font-normal fl:group-has-[[data-orientation=horizontal]]/field:text-balance",
        "fl:last:mt-0 fl:nth-last-2:-mt-1 fl:[[data-variant=legend]+&]:-mt-1.5",
        "fl:[&>a:hover]:text-primary fl:[&>a]:underline fl:[&>a]:underline-offset-4",
        className
      )}
      {...props}
    />
  );
}

function FieldSeparator({
  children,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  children?: React.ReactNode;
}) {
  return (
    <div
      data-slot="field-separator"
      data-content={!!children}
      className={cn(
        "fl:relative fl:-my-2 fl:h-5 fl:text-sm fl:group-data-[variant=outline]/field-group:-mb-2",
        className
      )}
      {...props}
    >
      <Separator className="fl:absolute fl:inset-0 fl:top-1/2" />
      {children && (
        <span
          className="fl:bg-background fl:text-muted-foreground fl:relative fl:mx-auto fl:block fl:w-fit fl:px-2"
          data-slot="field-separator-content"
        >
          {children}
        </span>
      )}
    </div>
  );
}

function FieldError({
  className,
  children,
  errors,
  ...props
}: React.ComponentProps<"div"> & {
  errors?: Array<{ message?: string } | undefined>;
}) {
  const content = useMemo(() => {
    if (children) {
      return children;
    }

    if (!errors?.length) {
      return null;
    }

    const uniqueErrors = [
      ...new Map(errors.map((error) => [error?.message, error])).values(),
    ];

    if (uniqueErrors?.length == 1) {
      return uniqueErrors[0]?.message;
    }

    return (
      <ul className="fl:ml-4 fl:flex fl:list-disc fl:flex-col fl:gap-1">
        {uniqueErrors.map(
          (error, index) =>
            error?.message && <li key={index}>{error.message}</li>
        )}
      </ul>
    );
  }, [children, errors]);

  if (!content) {
    return null;
  }

  return (
    <div
      role="alert"
      data-slot="field-error"
      className={cn("fl:text-destructive fl:text-sm fl:font-normal", className)}
      {...props}
    >
      {content}
    </div>
  );
}

export {
  Field,
  FieldLabel,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldContent,
  FieldTitle,
};
