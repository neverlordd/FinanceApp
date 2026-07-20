import React from "react";

type FigmaIconName =
  | "add-green"
  | "add-red"
  | "add"
  | "arrow-down"
  | "arrow-right"
  | "arrow-right-green"
  | "arrow-right-muted"
  | "arrow-right-red"
  | "calendar-edit"
  | "calendar-edit-bold"
  | "coin"
  | "coin-large"
  | "edit-2"
  | "money-send"
  | "money-send-bold"
  | "money-send-small"
  | "more"
  | "more-bold"
  | "refresh-2"
  | "tick-circle"
  | "trash"
  | "trash-muted"
  | "trash-plan"
  | "tick-circle-white"
  | "wallet"
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
