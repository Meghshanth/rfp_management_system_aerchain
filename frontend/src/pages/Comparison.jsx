import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
    Box,
    Paper,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Chip,
    Button,
    Grid,
    CircularProgress,
    Card,
    CardContent,
    Alert,
    LinearProgress
} from "@mui/material";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import RefreshIcon from "@mui/icons-material/Refresh";
import { useNavigate } from "react-router-dom";

export default function Comparison() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [rfp, setRfp] = useState(null);
    const [proposals, setProposals] = useState([]);
    const [recommendation, setRecommendation] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);
    const [autoRefresh, setAutoRefresh] = useState(true);

    const fetchData = async (showRefreshing = false) => {
        try {
            if (showRefreshing) setRefreshing(true);
            setError(null);

            // Fetch RFP details
            const rfpRes = await fetch(`http://localhost:5000/api/rfps/${id}`);
            if (!rfpRes.ok) throw new Error("Failed to fetch RFP details");
            const rfpData = await rfpRes.json();
            setRfp(rfpData.rfp);

            // Fetch AI recommendation (which includes proposals)
            const recRes = await fetch(`http://localhost:5000/api/vendor/recommendation/${id}`);
            if (!recRes.ok) throw new Error("Failed to fetch recommendations");
            const recData = await recRes.json();
            setProposals(recData.proposals || []);
            setRecommendation(recData.recommendation);
        } catch (err) {
            console.error("Error fetching comparison data:", err);
            setError(err.message || "Failed to load comparison data");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [id]);

    // Auto-refresh every 15 seconds
    useEffect(() => {
        if (!autoRefresh) return;

        const interval = setInterval(() => {
            fetchData(true);
        }, 15000);

        return () => clearInterval(interval);
    }, [id, autoRefresh]);

    if (loading) {
        return (
            <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", bgcolor: "#121212", color: "white" }}>
                <CircularProgress color="inherit" />
            </Box>
        );
    }

    if (!rfp) {
        return (
            <Box sx={{ p: 4, color: "white" }}>
                <Alert severity="error">RFP not found.</Alert>
            </Box>
        );
    }

    const recommendedId = recommendation?.recommended_vendor_id;

    return (
        <Box sx={{ minHeight: "100vh", bgcolor: "#121212", color: "white", p: 4, maxWidth: "1200px", mx: "auto" }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                <Box>
                    <Button
                        startIcon={<ArrowBackIcon />}
                        onClick={() => navigate("/")}
                        sx={{ mb: 1, color: "grey.400" }}
                    >
                        &lt; Create New RFP
                    </Button>
                    <Typography variant="h4" fontWeight="bold" gutterBottom>
                        Proposal Comparison
                    </Typography>
                    <Typography variant="h6" color="grey.400" gutterBottom>
                        {rfp.title}
                    </Typography>
                </Box>
                <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                    <Button
                        startIcon={<RefreshIcon />}
                        onClick={() => fetchData(true)}
                        disabled={refreshing}
                        variant="outlined"
                        sx={{ color: "grey.400", borderColor: "grey.600" }}
                    >
                        {refreshing ? "Refreshing..." : "Refresh"}
                    </Button>
                    <Chip
                        label={autoRefresh ? "Auto-refresh ON" : "Auto-refresh OFF"}
                        onClick={() => setAutoRefresh(!autoRefresh)}
                        color={autoRefresh ? "success" : "default"}
                        size="small"
                        variant="outlined"
                    />
                </Box>
            </Box>

            {refreshing && <LinearProgress sx={{ mb: 2 }} />}
            {error && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                    {error}
                </Alert>
            )}

            <Grid container spacing={3} sx={{ mt: 2 }}>
                {/* 1. Comparison Table */}
                <Grid item xs={12}>
                    <TableContainer component={Paper} sx={{ bgcolor: "#1E1E1E" }}>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ color: "grey.400" }}>Vendor</TableCell>
                                    <TableCell sx={{ color: "grey.400" }}>AI Score</TableCell>
                                    <TableCell sx={{ color: "grey.400" }}>Price</TableCell>
                                    <TableCell sx={{ color: "grey.400" }}>Delivery</TableCell>
                                    <TableCell sx={{ color: "grey.400" }}>Warranty</TableCell>
                                    <TableCell sx={{ color: "grey.400" }}>AI Summary</TableCell>
                                    <TableCell sx={{ color: "grey.400" }}>Status</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {proposals.map((p) => {
                                    const isRecommended = p.id === recommendedId;
                                    return (
                                        <TableRow
                                            key={p.id}
                                            sx={{
                                                "&:last-child td, &:last-child th": { border: 0 },
                                                bgcolor: isRecommended ? "rgba(25, 195, 125, 0.15)" : "inherit",
                                                borderLeft: isRecommended ? "3px solid #19c37d" : "none"
                                            }}
                                        >
                                            <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                                                {p.vendor_name}
                                                {isRecommended && (
                                                    <Chip
                                                        icon={<SmartToyIcon sx={{ fontSize: "16px !important" }} />}
                                                        label="Recommended"
                                                        color="success"
                                                        size="small"
                                                        sx={{ ml: 1, height: 20, fontSize: "0.7rem" }}
                                                    />
                                                )}
                                            </TableCell>
                                            <TableCell sx={{ color: "white" }}>
                                                {p.ai_score !== null && p.ai_score !== undefined ? (
                                                    <Chip
                                                        label={`${p.ai_score}/100`}
                                                        color={p.ai_score >= 80 ? "success" : p.ai_score >= 60 ? "warning" : "error"}
                                                        size="small"
                                                    />
                                                ) : (
                                                    "N/A"
                                                )}
                                            </TableCell>
                                            <TableCell sx={{ color: "white" }}>{p.extracted_data?.price || "N/A"}</TableCell>
                                            <TableCell sx={{ color: "white" }}>{p.extracted_data?.delivery || "N/A"}</TableCell>
                                            <TableCell sx={{ color: "white" }}>{p.extracted_data?.warranty || "N/A"}</TableCell>
                                            <TableCell sx={{ color: "grey.300", maxWidth: 300 }}>
                                                <Typography variant="body2" sx={{ fontSize: "0.85rem" }}>
                                                    {p.ai_summary || "No summary available."}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Chip label="Received" color="primary" variant="outlined" size="small" />
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                                {proposals.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={7} sx={{ textAlign: "center", color: "grey.500", py: 4 }}>
                                            No proposals received yet. Waiting for vendor responses...
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Grid>

                {/* 2. AI Recommendation Card */}
                {recommendation && (
                    <Grid item xs={12}>
                        <Card sx={{ bgcolor: "rgba(25, 195, 125, 0.15)", border: "2px solid #19c37d", color: "white", borderRadius: "12px" }}>
                            <CardContent>
                                <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
                                    <SmartToyIcon color="success" fontSize="large" />
                                    <Typography variant="h5" fontWeight="bold">
                                        AI Recommendation
                                    </Typography>
                                </Box>
                                <Typography variant="h6" sx={{ mb: 2, color: "#19c37d" }}>
                                    Recommended Vendor: <b>{recommendation.recommended_vendor}</b>
                                </Typography>
                                <Typography variant="body1" sx={{ mb: 2, lineHeight: 1.8 }}>
                                    {recommendation.reasoning}
                                </Typography>
                                {recommendation.key_factors && recommendation.key_factors.length > 0 && (
                                    <Box sx={{ mt: 2 }}>
                                        <Typography variant="subtitle2" color="grey.400" sx={{ mb: 1 }}>
                                            Key Factors:
                                        </Typography>
                                        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                                            {recommendation.key_factors.map((factor, idx) => (
                                                <Chip
                                                    key={idx}
                                                    label={factor}
                                                    size="small"
                                                    sx={{ bgcolor: "rgba(25, 195, 125, 0.2)", color: "#19c37d" }}
                                                />
                                            ))}
                                        </Box>
                                    </Box>
                                )}
                            </CardContent>
                        </Card>
                    </Grid>
                )}
            </Grid>
        </Box>
    );
}
