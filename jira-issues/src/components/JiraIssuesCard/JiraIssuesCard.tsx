import React from 'react';
import { useEntity } from '@backstage/plugin-catalog-react';
import { Table, TableColumn, Progress } from '@backstage/core-components';
import { Link } from '@backstage/core-components';
import { Chip, Button, Box, Typography, FormControl, InputLabel, Select, MenuItem, Grid, useTheme } from '@material-ui/core';
import RefreshIcon from '@material-ui/icons/Refresh';
import ClearIcon from '@material-ui/icons/Clear';

interface JiraIssue {
    key: string;
    fields: {
        summary: string;
        status?: {
            name: string;
        };
        assignee?: {
            displayName: string;
            emailAddress?: string;
        };
        priority?: {
            name: string;
        };
        issuetype?: {
            name: string;
        };
    };
}

interface CachedData {
    issues: JiraIssue[];
    timestamp: number;
}

// Cache duration: 3 hours in milliseconds
const CACHE_DURATION = 3 * 60 * 60 * 1000;

// Helper function to get status color
const getStatusColor = (status: string): { color: 'primary' | 'secondary' | 'default'; style?: React.CSSProperties } => {
    const statusLower = status.toLowerCase();

    // Done states (green) - though these should be filtered out by backend
    if (statusLower.includes('done') || statusLower.includes('closed') || statusLower.includes('resolved')) {
        return { color: 'primary' };
    }

    // In Progress states (blue)
    if (statusLower.includes('progress')) {
        return { color: 'primary', style: { backgroundColor: '#1976d2', color: 'white' } };
    }

    // Review states (purple)
    if (statusLower.includes('review')) {
        return { color: 'secondary', style: { backgroundColor: '#9c27b0', color: 'white' } };
    }

    // To Do / New states (orange)
    if (statusLower.includes('to do') || statusLower.includes('new') || statusLower.includes('open')) {
        return { color: 'default', style: { backgroundColor: '#ff9800', color: 'white' } };
    }

    // Blocked / On Hold states (red)
    if (statusLower.includes('block') || statusLower.includes('hold') || statusLower.includes('wait')) {
        return { color: 'default', style: { backgroundColor: '#f44336', color: 'white' } };
    }

    // Testing / QA states (teal)
    if (statusLower.includes('test') || statusLower.includes('qa')) {
        return { color: 'default', style: { backgroundColor: '#009688', color: 'white' } };
    }

    // Release Pending states (green)
    if (statusLower.includes('release') && statusLower.includes('pending')) {
        return { color: 'primary', style: { backgroundColor: '#4caf50', color: 'white' } };
    }

    // Default (gray)
    return { color: 'default' };
};

// Helper function to get issue type row style
const getIssueTypeRowStyle = (issueType: string, isDarkMode: boolean): React.CSSProperties => {
    const typeLower = issueType.toLowerCase();

    if (isDarkMode) {
        // Dark mode colors - subtle backgrounds with light text
        if (typeLower.includes('bug')) {
            return { backgroundColor: 'rgba(244, 67, 54, 0.15)' }; // Subtle red
        }
        if (typeLower.includes('epic')) {
            return { backgroundColor: 'rgba(33, 150, 243, 0.15)' }; // Subtle blue
        }
        if (typeLower.includes('story')) {
            return { backgroundColor: 'rgba(76, 175, 80, 0.15)' }; // Subtle green
        }
        if (typeLower.includes('spike')) {
            return { backgroundColor: 'rgba(255, 152, 0, 0.15)' }; // Subtle orange
        }
        if (typeLower.includes('task')) {
            return { backgroundColor: 'rgba(156, 39, 176, 0.15)' }; // Subtle purple
        }
        if (typeLower.includes('improvement') || typeLower.includes('enhancement')) {
            return { backgroundColor: 'rgba(0, 150, 136, 0.15)' }; // Subtle teal
        }
    } else {
        // Light mode colors - lighter backgrounds with dark text
        if (typeLower.includes('bug')) {
            return { backgroundColor: '#ffebee' }; // Light red
        }
        if (typeLower.includes('epic')) {
            return { backgroundColor: '#e1f5fe' }; // Light blue
        }
        if (typeLower.includes('story')) {
            return { backgroundColor: '#e8f5e9' }; // Light green
        }
        if (typeLower.includes('spike')) {
            return { backgroundColor: '#fff3e0' }; // Light orange
        }
        if (typeLower.includes('task')) {
            return { backgroundColor: '#f3e5f5' }; // Light purple
        }
        if (typeLower.includes('improvement') || typeLower.includes('enhancement')) {
            return { backgroundColor: '#e0f2f1' }; // Light teal
        }
    }

    return {}; // Default - no special styling
};

// Helper function to format time ago
const formatTimeAgo = (timestamp: number): string => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);

    if (seconds < 60) return 'just now';

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;

    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? 's' : ''} ago`;
};

export const JiraIssuesCard = () => {
    const { entity } = useEntity();
    const theme = useTheme();
    const isDarkMode = theme.palette.type === 'dark';

    const [issues, setIssues] = React.useState<JiraIssue[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [lastUpdated, setLastUpdated] = React.useState<number | null>(null);
    const [timeAgo, setTimeAgo] = React.useState<string>('');

    // Filters
    const [selectedType, setSelectedType] = React.useState<string>('');
    const [selectedAssignee, setSelectedAssignee] = React.useState<string>('');
    const [selectedStatus, setSelectedStatus] = React.useState<string>('');
    const [selectedPriority, setSelectedPriority] = React.useState<string>('');

    const projectKey = entity.metadata.annotations?.['jira/project-key'];
    const cacheKey = `jira-issues-${projectKey}`;

    const fetchIssues = React.useCallback(async (forceRefresh = false) => {
        if (!projectKey) return;

        // Check cache first
        if (!forceRefresh) {
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                try {
                    const cachedData: CachedData = JSON.parse(cached);
                    const age = Date.now() - cachedData.timestamp;

                    // If cache is still valid (less than 3 hours old)
                    if (age < CACHE_DURATION) {
                        setIssues(cachedData.issues);
                        setLastUpdated(cachedData.timestamp);
                        setLoading(false);
                        return;
                    }
                } catch (e) {
                    // Invalid cache, will fetch fresh data
                    console.warn('Invalid cache data, fetching fresh data');
                }
            }
        }

        // Fetch fresh data
        setLoading(true);
        try {
            const res = await fetch(`http://localhost:7007/api/jira-issues/issues/${projectKey}`);
            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }
            const data = await res.json();
            const fetchedIssues = data.issues || [];
            const timestamp = Date.now();

            setIssues(fetchedIssues);
            setLastUpdated(timestamp);

            // Save to cache
            const cacheData: CachedData = {
                issues: fetchedIssues,
                timestamp
            };
            localStorage.setItem(cacheKey, JSON.stringify(cacheData));
        } catch (err) {
            console.error('Failed to fetch Jira issues:', err);
        } finally {
            setLoading(false);
        }
    }, [projectKey, cacheKey]);

    // Initial fetch
    React.useEffect(() => {
        fetchIssues();
    }, [fetchIssues]);

    // Update "time ago" display every minute
    React.useEffect(() => {
        if (!lastUpdated) return;

        const updateTimeAgo = () => {
            setTimeAgo(formatTimeAgo(lastUpdated));
        };

        updateTimeAgo();
        const interval = setInterval(updateTimeAgo, 60000); // Update every minute

        return () => clearInterval(interval);
    }, [lastUpdated]);

    const handleRefresh = () => {
        fetchIssues(true);
    };

    const handleClearFilters = () => {
        setSelectedType('');
        setSelectedAssignee('');
        setSelectedStatus('');
        setSelectedPriority('');
    };

    // Get unique values for filters
    const types = React.useMemo(() => {
        const uniqueTypes = new Set(issues.map(issue => issue.fields.issuetype?.name).filter(Boolean));
        return Array.from(uniqueTypes).sort();
    }, [issues]);

    const assignees = React.useMemo(() => {
        const uniqueAssignees = new Set(
            issues.map(issue => issue.fields.assignee?.displayName).filter(Boolean)
        );
        return Array.from(uniqueAssignees).sort();
    }, [issues]);

    const statuses = React.useMemo(() => {
        const uniqueStatuses = new Set(issues.map(issue => issue.fields.status?.name).filter(Boolean));
        return Array.from(uniqueStatuses).sort();
    }, [issues]);

    const priorities = React.useMemo(() => {
        const uniquePriorities = new Set(issues.map(issue => issue.fields.priority?.name).filter(Boolean));
        return Array.from(uniquePriorities).sort();
    }, [issues]);

    // Filter issues based on selected filters
    const filteredIssues = React.useMemo(() => {
        return issues.filter(issue => {
            if (selectedType && issue.fields.issuetype?.name !== selectedType) return false;
            if (selectedAssignee && issue.fields.assignee?.displayName !== selectedAssignee) return false;
            if (selectedStatus && issue.fields.status?.name !== selectedStatus) return false;
            if (selectedPriority && issue.fields.priority?.name !== selectedPriority) return false;
            return true;
        });
    }, [issues, selectedType, selectedAssignee, selectedStatus, selectedPriority]);

    const hasActiveFilters = selectedType || selectedAssignee || selectedStatus || selectedPriority;

    if (!projectKey) return null;

    if (loading && !issues.length) {
        return <Progress />;
    }

    const columns: TableColumn[] = [
        {
            title: 'Key',
            field: 'key',
            width: '10%',
            render: (row: any) => (
                <Link
                    to={`https://issues.redhat.com/browse/${row.key}`}
                    target="_blank"
                    style={{
                        color: isDarkMode ? '#90caf9' : '#1976d2',
                        textDecoration: 'none',
                        fontWeight: 500
                    }}
                >
                    {row.key}
                </Link>
            ),
        },
        {
            title: 'Summary',
            field: 'fields.summary',
            width: '40%',
        },
        {
            title: 'Status',
            width: '10%',
            field: 'fields.status.name',
            render: (row: any) => {
                if (!row.fields.status) return null;
                const colorConfig = getStatusColor(row.fields.status.name);
                return (
                    <Chip
                        label={row.fields.status.name}
                        size="small"
                        color={colorConfig.color}
                        style={colorConfig.style}
                    />
                );
            },
        },
        {
            title: 'Type',
            width: '10%',
            field: 'fields.issuetype.name',
        },
        {
            title: 'Priority',
            width: '10%',
            field: 'fields.priority.name',
        },
        {
            title: 'Assignee',
            field: 'fields.assignee.displayName',
            render: (row: any) => row.fields.assignee?.displayName || 'Unassigned',
        },
    ];

    return (
        <Box>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="body2" color="textSecondary">
                    {lastUpdated && `Last updated: ${timeAgo}`}
                </Typography>
                <Button
                    variant="outlined"
                    size="small"
                    startIcon={loading ? undefined : <RefreshIcon />}
                    onClick={handleRefresh}
                    disabled={loading}
                >
                    {loading ? 'Refreshing...' : 'Refresh'}
                </Button>
            </Box>

            {/* Filters */}
            <Box mb={2}>
                <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} sm={6} md={3}>
                        <FormControl fullWidth size="small" variant="outlined">
                            <InputLabel>Type</InputLabel>
                            <Select
                                value={selectedType}
                                onChange={(e) => setSelectedType(e.target.value as string)}
                                label="Type"
                            >
                                <MenuItem value="">
                                    <em>All Types</em>
                                </MenuItem>
                                {types.map(type => (
                                    <MenuItem key={type} value={type}>{type}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <FormControl fullWidth size="small" variant="outlined">
                            <InputLabel>Assignee</InputLabel>
                            <Select
                                value={selectedAssignee}
                                onChange={(e) => setSelectedAssignee(e.target.value as string)}
                                label="Assignee"
                            >
                                <MenuItem value="">
                                    <em>All Assignees</em>
                                </MenuItem>
                                {assignees.map(assignee => (
                                    <MenuItem key={assignee} value={assignee}>{assignee}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={6} md={2}>
                        <FormControl fullWidth size="small" variant="outlined">
                            <InputLabel>Status</InputLabel>
                            <Select
                                value={selectedStatus}
                                onChange={(e) => setSelectedStatus(e.target.value as string)}
                                label="Status"
                            >
                                <MenuItem value="">
                                    <em>All Statuses</em>
                                </MenuItem>
                                {statuses.map(status => (
                                    <MenuItem key={status} value={status}>{status}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={6} md={2}>
                        <FormControl fullWidth size="small" variant="outlined">
                            <InputLabel>Priority</InputLabel>
                            <Select
                                value={selectedPriority}
                                onChange={(e) => setSelectedPriority(e.target.value as string)}
                                label="Priority"
                            >
                                <MenuItem value="">
                                    <em>All Priorities</em>
                                </MenuItem>
                                {priorities.map(priority => (
                                    <MenuItem key={priority} value={priority}>{priority}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={12} md={2}>
                        <Button
                            fullWidth
                            variant="text"
                            size="small"
                            startIcon={<ClearIcon />}
                            onClick={handleClearFilters}
                            disabled={!hasActiveFilters}
                        >
                            Clear Filters
                        </Button>
                    </Grid>
                </Grid>
            </Box>

            <Table
                title={`Jira Issues (${filteredIssues.length}${hasActiveFilters ? ` of ${issues.length}` : ''})`}
                options={{
                    search: true,
                    paging: true,
                    pageSize: 10,
                    pageSizeOptions: [10, 20, 50],
                    sorting: true,
                    rowStyle: (rowData: any) =>
                        rowData.fields?.issuetype?.name
                            ? getIssueTypeRowStyle(rowData.fields.issuetype.name, isDarkMode)
                            : {},
                }}
                columns={columns}
                data={filteredIssues}
            />
        </Box>
    );
};
