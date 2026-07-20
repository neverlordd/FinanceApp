import React from "react";

type FigmaIconName =
  | "add-green"
  | "add-red"
  | "arrow-down"
  | "arrow-right-green"
  | "arrow-right-red"
  | "calendar-edit"
  | "coin"
  | "edit-2"
  | "money-send"
  | "money-send-small"
  | "more"
  | "refresh-2"
  | "tick-circle"
  | "trash"
  | "wallet-money";

interface FigmaIconProps {
  name: FigmaIconName;
  size?: number;
  className?: string;
}

export const FigmaIcon: React.FC<FigmaIconProps> = ({ name, size = 16, className = "" }) => (
  <img
    src={`${import.meta.env.BASE_URL}figma-icons/${name}.svg`}
    width={size}
    height={size}
    className={`block shrink-0 ${className}`}
    alt=""
    aria-hidden="true"
  />
);
