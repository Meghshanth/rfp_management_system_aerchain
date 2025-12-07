import { useEffect, useState } from "react";
import {
    Box,
    Typography,
    Card,
    CardContent,
    Grid,
    Chip,
    Button,
    Divider,
    CircularProgress,
    Alert,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Accordion,
    AccordionSummary,
    AccordionDetails
} from "@mui/material";
import VisibilityIcon from "@mui/icons-material/Visibility";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import { useNavigate } from "react-router-dom";

export default function RfpList() {
    const [rfps, setRfps] = useState([]);
    const [proposalsMap, setProposalsMap] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [loadingProposals, setLoadingProposals] = useState({});
    const navigate = useNavigate();

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                setError(null);
                const res = await fetch("http://localhost:5000/api/rfps");

                if (!res.ok) {
                    throw new Error(`Failed to fetch RFPs: ${res.status}`);
                }

                const data = await res.json();
                setRfps(data.rfps || []);

                // Fetch proposals for each RFP
                const proposalsPromises = (data.rfps || []).map(async (rfp) => {
                    try {
                        const propRes = await fetch(`http://localhost:5000/api/vendor/proposals/${rfp.id}`);
                        if (propRes.ok) {
                            const propData = await propRes.json();
                            return { rfpId: rfp.id, proposals: propData.proposals || [] };
                        }
                    } catch (err) {
                        console.error(`Failed to fetch proposals for RFP ${rfp.id}:`, err);
                    }
                    return { rfpId: rfp.id, proposals: [] };
                });

                const proposalsResults = await Promise.all(proposalsPromises);
                const proposalsMap = {};
                proposalsResults.forEach(({ rfpId, proposals }) => {
                    proposalsMap[rfpId] = proposals;
                });
                setProposalsMap(proposalsMap);
            } catch (err) {
                console.error("Failed to load RFPs", err);
                setError(err.message || "Failed to load RFPs. Please check if the backend is running.");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const fetchProposalsForRfp = async (rfpId) => {
        if (proposalsMap[rfpId]) return; // Already loaded

        setLoadingProposals(prev => ({ ...prev, [rfpId]: true }));
        try {
            const res = await fetch(`http://localhost:5000/api/vendor/proposals/${rfpId}`);
            if (res.ok) {
                const data = await res.json();
                setProposalsMap(prev => ({ ...prev, [rfpId]: data.proposals || [] }));
            }
        } catch (err) {
            console.error(`Failed to fetch proposals for RFP ${rfpId}:`, err);
        } finally {
            setLoadingProposals(prev => ({ ...prev, [rfpId]: false }));
        }
    };

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
                RFP Management
            </Typography>

            {rfps.length === 0 ? (
                <Alert severity="info" sx={{ bgcolor: "#1E1E1E", color: "white" }}>
                    No RFPs found. Create your first RFP from the RFP Generator page.
                </Alert>
            ) : (
                <Grid container spacing={3}>
                    {rfps.map((rfp) => (
                        <Grid item xs={12} md={6} lg={4} key={rfp.id}>
                            <Card sx={{ bgcolor: "#1E1E1E", color: "white", border: "1px solid #333", borderRadius: "12px", height: "100%", display: "flex", flexDirection: "column" }}>
                                <CardContent sx={{ flexGrow: 1, display: "flex", flexDirection: "column" }}>
                                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 2 }}>
                                        <Typography variant="h6" fontWeight="bold" sx={{ mr: 1, lineHeight: 1.3 }}>
                                            RFP #{rfp.id}: {rfp.title.replace(/Request for Proposal/i, "").trim()}
                                        </Typography>
                                        <Chip
                                            label={rfp.status}
                                            color={rfp.status === "SENT" ? "success" : rfp.status === "CLOSED" ? "default" : "warning"}
                                            size="small"
                                            variant="outlined"
                                            sx={{ minWidth: "fit-content" }}
                                        />
                                    </Box>

                                    <Typography variant="body2" color="grey.400" sx={{ mb: 3 }}>
                                        Created on {new Date(rfp.created_at).toLocaleDateString()}
                                    </Typography>

                                    <Box sx={{ mt: "auto" }}>
                                        <Button
                                            variant="outlined"
                                            fullWidth
                                            startIcon={<VisibilityIcon />}
                                            onClick={() => navigate(`/compare/${rfp.id}`)}
                                            sx={{
                                                color: "#19c37d",
                                                borderColor: "#19c37d",
                                                "&:hover": { borderColor: "#15a067", bgcolor: "rgba(25, 195, 125, 0.08)" }
                                            }}
                                        >
                                            View Full Comparison
                                        </Button>
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
