import * as React from "react";
import { useContainerSize } from "../hooks/use-container-size";

interface MeasuredContainerProps<T extends React.ElementType> {
  as: T;
  name: string;
  children?: React.ReactNode;
}

export const MeasuredContainer = <T extends React.ElementType>({
  ref,
  as: Component,
  name,
  children,
  style = {},
  ...props
}: MeasuredContainerProps<T> & React.ComponentProps<T>) => {
  const [element, setElement] = React.useState<HTMLElement | null>(null);
  const rect = useContainerSize(element);

  React.useImperativeHandle(ref, () => element as HTMLElement, [element]);

  const customStyle = {
    [`--${name}-width`]: `${rect.width}px`,
    [`--${name}-height`]: `${rect.height}px`,
  };

  return (
    <Component {...props} ref={setElement} style={{ ...customStyle, ...style }}>
      {children}
    </Component>
  );
};

MeasuredContainer.displayName = "MeasuredContainer";
