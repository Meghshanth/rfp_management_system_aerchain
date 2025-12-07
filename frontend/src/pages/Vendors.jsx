import { useEffect, useState } from "react";
import { Box, Typography, Card, CardContent, Grid, Avatar, CircularProgress, Alert } from "@mui/material";
import PeopleIcon from "@mui/icons-material/People";

export default function Vendors() {
    const [vendors, setVendors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchVendors = async () => {
            try {
                setLoading(true);
                setError(null);
                const res = await fetch("http://localhost:5000/api/rfps/vendors");

                if (!res.ok) {
                    throw new Error(`Failed to fetch vendors: ${res.status}`);
                }

                const data = await res.json();
                setVendors(data.vendors || []);
            } catch (err) {
                console.error("Failed to load vendors", err);
                setError(err.message || "Failed to load vendors. Please check if the backend is running.");
            } finally {
                setLoading(false);
            }
        };

        fetchVendors();
    }, []);

    if (loading) {
        return (
            <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", bgcolor: "#121212" }}>
                <CircularProgress sx={{ color: "#19c37d" }} />
            </Box>
        );
    }

    if (error) {
        return (
            <Box sx={{ p: 4, color: "white" }}>
                <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                </Alert>
            </Box>
        );
    }

    return (
        <Box sx={{ p: 4, color: "white", bgcolor: "#121212", minHeight: "100vh", width: "100%", maxWidth: "1200px", mx: "auto" }}>
            <Typography variant="h4" fontWeight="bold" gutterBottom sx={{ mb: 4 }}>
                Vendor Database
            </Typography>

            {vendors.length === 0 ? (
                <Alert severity="info" sx={{ bgcolor: "#1E1E1E", color: "white" }}>
                    No vendors found. Vendors are seeded in the database. Please check:
                    <ul style={{ marginTop: "8px", paddingLeft: "20px" }}>
                        <li>Database is running and connected</li>
                        <li>Schema has been initialized (run schema.sql)</li>
                        <li>Backend server is running on port 5000</li>
                    </ul>
                </Alert>
            ) : (
                <Grid container spacing={3}>
                    {vendors.map((vendor) => (
                        <Grid item xs={12} md={6} lg={4} key={vendor.id}>
                            <Card sx={{ bgcolor: "#1E1E1E", color: "white", border: "1px solid #333", borderRadius: "12px" }}>
                                <CardContent sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                                    <Avatar sx={{ bgcolor: "#3f51b5", width: 50, height: 50 }}>
                                        <PeopleIcon />
                                    </Avatar>
                                    <Box>
                                        <Typography variant="h6" fontWeight="bold">
                                            {vendor.vendor_name}
                                        </Typography>
                                        <Typography variant="body2" color="grey.400">
                                            {vendor.contact_name || "No contact name"}
                                        </Typography>
                                        <Typography variant="caption" color="grey.500" display="block">
                                            {vendor.contact_email}
                                        </Typography>
                                    </Box>
                                </CardContent>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            )}
        </Box>
    );
}
