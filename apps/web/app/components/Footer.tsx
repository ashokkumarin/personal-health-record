import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { APP_RELEASE_LABEL } from "@phr/shared";

export default function Footer() {
  return (
    <Box component="footer" sx={{ py: 2, textAlign: "center" }}>
      <Typography variant="caption" color="text.secondary">
        PHR &middot; {APP_RELEASE_LABEL} &middot; &copy; {new Date().getFullYear()}
      </Typography>
    </Box>
  );
}
