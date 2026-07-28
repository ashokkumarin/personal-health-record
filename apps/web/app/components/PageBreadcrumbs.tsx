"use client";

import Link from "next/link";
import Breadcrumbs from "@mui/material/Breadcrumbs";
import MuiLink from "@mui/material/Link";
import Typography from "@mui/material/Typography";

export interface Crumb {
  label: string;
  href?: string;
}

export default function PageBreadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <Breadcrumbs sx={{ mb: 1.5 }}>
      {items.map((item, i) =>
        item.href ? (
          <MuiLink key={i} component={Link} href={item.href} underline="hover" color="inherit">
            {item.label}
          </MuiLink>
        ) : (
          <Typography key={i} color="text.primary">
            {item.label}
          </Typography>
        )
      )}
    </Breadcrumbs>
  );
}
