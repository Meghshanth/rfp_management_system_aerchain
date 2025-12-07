import { Box, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Typography, Divider } from "@mui/material";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import PeopleIcon from "@mui/icons-material/People";
import { useLocation, useNavigate } from "react-router-dom";

export default function Sidebar() {
    const navigate = useNavigate();
    const location = useLocation();

    const menuItems = [
        { text: "RFP Generator", icon: <SmartToyIcon />, path: "/" },
        { text: "RFPs & Proposals", icon: <FormatListBulletedIcon />, path: "/rfps" },
        { text: "Vendors", icon: <PeopleIcon />, path: "/vendors" },
    ];

    return (
        <Box
            sx={{
                width: 260,
                height: "100vh",
                bgcolor: "#1a1a1a",
                borderRight: "1px solid #333",
                display: "flex",
                flexDirection: "column",
                flexShrink: 0,
            }}
        >
            <Box sx={{ p: 3, display: "flex", alignItems: "center", gap: 2 }}>
                <Box
                    sx={{
                        width: 40,
                        height: 40,
                        bgcolor: "#19c37d",
                        borderRadius: "8px",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                    }}
                >
                    <SmartToyIcon sx={{ color: "white" }} />
                </Box>
                <Typography variant="h6" fontWeight="bold" color="white" sx={{ lineHeight: 1.2 }}>
                    AERCHAIN
                </Typography>
            </Box>

            <Divider sx={{ borderColor: "#333", mb: 2 }} />

            <List sx={{ px: 2 }}>
                {menuItems.map((item) => {
                    const isActive = location.pathname === item.path || (item.path !== "/" && location.pathname.startsWith(item.path));
                    return (
                        <ListItem key={item.text} disablePadding sx={{ mb: 1 }}>
                            <ListItemButton
                                onClick={() => navigate(item.path)}
                                sx={{
                                    borderRadius: "8px",
                                    bgcolor: isActive ? "rgba(25, 195, 125, 0.15)" : "transparent",
                                    color: isActive ? "#19c37d" : "grey.400",
                                    "&:hover": {
                                        bgcolor: "rgba(25, 195, 125, 0.08)",
                                        color: "#19c37d",
                                    },
                                }}
                            >
                                <ListItemIcon sx={{ color: "inherit", minWidth: 40 }}>
                                    {item.icon}
                                </ListItemIcon>
                                <ListItemText
                                    primary={item.text}
                                    primaryTypographyProps={{ fontSize: "0.95rem", fontWeight: isActive ? 600 : 400 }}
                                />
                            </ListItemButton>
                        </ListItem>
                    );
                })}
            </List>

            <Box sx={{ mt: "auto", p: 3 }}>
                <Typography variant="caption" color="grey.700">
                    AERCHAIN AI v1.0
                </Typography>
            </Box>
        </Box>
    );
}
