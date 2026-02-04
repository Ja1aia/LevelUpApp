import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    TextInput,
    Alert,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { COLORS } from '../theme/colors';
import {
    searchCommunities,
    getCommunityInvites,
    getUserJoinRequests,
    acceptCommunityInvite,
    rejectCommunityInvite,
    requestToJoinCommunity,
    joinCommunity,
    getUserCommunity,
} from '../services/database';

interface CommunityListScreenProps {
    userId: string;
    onBack: () => void;
    onCreateCommunity: () => void;
    onViewCommunityHub: () => void;
}

interface Community {
    id: string;
    name: string;
    description: string;
    badge: string;
    member_count: number;
    max_members: number;
    visibility: 'open' | 'invite_only' | 'closed';
    leader: {
        username: string;
        elo: number;
        avatar: string;
    };
}

interface CommunityInvite {
    id: string;
    created_at: string;
    expires_at: string;
    inviter: {
        username: string;
        elo: number;
        avatar: string;
    };
    community: {
        id: string;
        name: string;
        badge: string;
        member_count: number;
        max_members: number;
    };
}

interface JoinRequest {
    id: string;
    status: string;
    created_at: string;
    community: {
        id: string;
        name: string;
        badge: string;
        member_count: number;
        max_members: number;
    };
}

export default function CommunityListScreen({
    userId,
    onBack,
    onCreateCommunity,
    onViewCommunityHub
}: CommunityListScreenProps) {
    const [activeTab, setActiveTab] = useState<'browse' | 'invites' | 'requests'>('browse');
    const [communities, setCommunities] = useState<Community[]>([]);
    const [invites, setInvites] = useState<CommunityInvite[]>([]);
    const [requests, setRequests] = useState<JoinRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [userCommunity, setUserCommunity] = useState<any>(null);
    const [processingAction, setProcessingAction] = useState<string | null>(null);

    useEffect(() => {
        fetchData();
    }, [userId]);

    const fetchData = async () => {
        setLoading(true);
        await Promise.all([
            fetchUserCommunity(),
            fetchCommunities(),
            fetchInvites(),
            fetchRequests()
        ]);
        setLoading(false);
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchData();
        setRefreshing(false);
    };

    const fetchUserCommunity = async () => {
        try {
            const { data } = await getUserCommunity(userId);
            if (data) {
                const formattedData = {
                    ...data,
                    community: Array.isArray(data.community) ? data.community[0] : data.community
                };
                setUserCommunity(formattedData);
            } else {
                setUserCommunity(null);
            }
        } catch (error) {
            console.error('Error fetching user community:', error);
        }
    };

    const fetchCommunities = async () => {
        try {
            const { data, error } = await searchCommunities(searchTerm);
            if (error) throw error;

            // Fix: Supabase might return joined relations as arrays
            const formattedData = (data || []).map((item: any) => ({
                ...item,
                leader: Array.isArray(item.leader) ? item.leader[0] : item.leader
            }));

            setCommunities(formattedData);
        } catch (error) {
            console.error('Error fetching communities:', error);
            setCommunities([]);
        }
    };

    const fetchInvites = async () => {
        try {
            const { data, error } = await getCommunityInvites(userId);
            if (error) throw error;

            const formattedData = (data || []).map((item: any) => ({
                ...item,
                inviter: Array.isArray(item.inviter) ? item.inviter[0] : item.inviter,
                community: Array.isArray(item.community) ? item.community[0] : item.community
            }));

            setInvites(formattedData);
        } catch (error) {
            console.error('Error fetching invites:', error);
            setInvites([]);
        }
    };

    const fetchRequests = async () => {
        try {
            const { data, error } = await getUserJoinRequests(userId);
            if (error) throw error;

            const formattedData = (data || []).map((item: any) => ({
                ...item,
                community: Array.isArray(item.community) ? item.community[0] : item.community
            }));

            setRequests(formattedData);
        } catch (error) {
            console.error('Error fetching requests:', error);
            setRequests([]);
        }
    };

    const handleSearch = async () => {
        await fetchCommunities();
    };

    const handleJoinCommunity = async (communityId: string, visibility: string) => {
        if (userCommunity) {
            Alert.alert('Already in Community', `You are already in "${userCommunity.community.name}". Leave your current community first.`);
            return;
        }

        setProcessingAction(communityId);
        try {
            if (visibility === 'open') {
                // Direct join
                const { error } = await joinCommunity(userId, communityId);
                if (error) throw error;

                Alert.alert('Success', 'You have joined the community!');
                await fetchUserCommunity();
                onViewCommunityHub();
            } else {
                // Request to join
                const { error } = await requestToJoinCommunity(userId, communityId, '');
                if (error) throw error;

                Alert.alert('Request Sent', 'Your join request has been sent to the community leaders.');
                await fetchRequests();
            }
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to join community');
        } finally {
            setProcessingAction(null);
        }
    };

    const handleAcceptInvite = async (inviteId: string) => {
        if (userCommunity) {
            Alert.alert('Already in Community', 'You are already in a community. Leave your current community first.');
            return;
        }

        setProcessingAction(inviteId);
        try {
            const { error } = await acceptCommunityInvite(inviteId, userId);
            if (error) throw error;

            Alert.alert('Success', 'You have joined the community!');
            await fetchData();
            onViewCommunityHub();
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to accept invite');
        } finally {
            setProcessingAction(null);
        }
    };

    const handleRejectInvite = async (inviteId: string) => {
        setProcessingAction(inviteId);
        try {
            const { error } = await rejectCommunityInvite(inviteId);
            if (error) throw error;

            await fetchInvites();
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to reject invite');
        } finally {
            setProcessingAction(null);
        }
    };

    const renderCommunityItem = ({ item }: { item: Community }) => {
        const isFull = item.member_count >= item.max_members;
        const hasPendingRequest = requests.some(r => r.community.id === item.id);
        const isProcessing = processingAction === item.id;

        return (
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <Text style={styles.badge}>{item.badge}</Text>
                    <View style={styles.cardInfo}>
                        <Text style={styles.communityName}>{item.name}</Text>
                        <Text style={styles.communityMeta}>
                            {item.member_count}/{item.max_members} members • {getVisibilityLabel(item.visibility)}
                        </Text>
                        {item.description && (
                            <Text style={styles.description} numberOfLines={2}>{item.description}</Text>
                        )}
                        <Text style={styles.leader}>
                            Leader: {item.leader?.username || 'Unknown'} ({item.leader?.elo || 0} ELO)
                        </Text>
                    </View>
                </View>

                <TouchableOpacity
                    style={[
                        styles.actionButton,
                        (isFull || hasPendingRequest || isProcessing || !!userCommunity) && styles.disabledButton
                    ]}
                    onPress={() => handleJoinCommunity(item.id, item.visibility)}
                    disabled={isFull || hasPendingRequest || isProcessing || !!userCommunity}
                >
                    {isProcessing ? (
                        <ActivityIndicator color="white" size="small" />
                    ) : (
                        <Text style={styles.actionButtonText}>
                            {isFull ? 'Full' :
                                hasPendingRequest ? 'Pending...' :
                                    item.visibility === 'open' ? 'Join' : 'Request to Join'}
                        </Text>
                    )}
                </TouchableOpacity>
            </View>
        );
    };

    const renderInviteItem = ({ item }: { item: CommunityInvite }) => {
        const isProcessing = processingAction === item.id;

        return (
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <Text style={styles.badge}>{item.community.badge}</Text>
                    <View style={styles.cardInfo}>
                        <Text style={styles.communityName}>{item.community.name}</Text>
                        <Text style={styles.communityMeta}>
                            {item.community.member_count}/{item.community.max_members} members
                        </Text>
                        <Text style={styles.inviteFrom}>
                            From: {item.inviter?.username || 'Unknown'} ({item.inviter?.elo || 0} ELO)
                        </Text>
                        <Text style={styles.timeAgo}>{getTimeAgo(item.created_at)}</Text>
                    </View>
                </View>

                <View style={styles.actionButtons}>
                    <TouchableOpacity
                        style={[styles.acceptButton, isProcessing && styles.disabledButton]}
                        onPress={() => handleAcceptInvite(item.id)}
                        disabled={isProcessing}
                    >
                        <Text style={styles.actionButtonText}>Accept</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.rejectButton, isProcessing && styles.disabledButton]}
                        onPress={() => handleRejectInvite(item.id)}
                        disabled={isProcessing}
                    >
                        <Text style={styles.rejectButtonText}>Reject</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    const renderRequestItem = ({ item }: { item: JoinRequest }) => {
        return (
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <Text style={styles.badge}>{item.community.badge}</Text>
                    <View style={styles.cardInfo}>
                        <Text style={styles.communityName}>{item.community.name}</Text>
                        <Text style={styles.communityMeta}>
                            {item.community.member_count}/{item.community.max_members} members
                        </Text>
                        <Text style={styles.statusPending}>Status: Pending</Text>
                        <Text style={styles.timeAgo}>Sent {getTimeAgo(item.created_at)}</Text>
                    </View>
                </View>
            </View>
        );
    };

    const getVisibilityLabel = (visibility: string) => {
        switch (visibility) {
            case 'open': return '🌍 Open';
            case 'invite_only': return '🔒 Invite-Only';
            case 'closed': return '🚫 Closed';
            default: return visibility;
        }
    };

    const getTimeAgo = (dateString: string) => {
        const now = new Date();
        const past = new Date(dateString);
        const diffMs = now.getTime() - past.getTime();
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours}h ago`;
        const diffDays = Math.floor(diffHours / 24);
        return `${diffDays}d ago`;
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.backButton}>
                    <Text style={styles.backButtonText}>Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Communities</Text>
                <TouchableOpacity
                    onPress={onCreateCommunity}
                    style={styles.createButton}
                    disabled={!!userCommunity}
                >
                    <Text style={styles.createButtonText}>Create</Text>
                </TouchableOpacity>
            </View>

            {/* User Community Banner */}
            {userCommunity && (
                <TouchableOpacity
                    style={styles.userCommunityBanner}
                    onPress={onViewCommunityHub}
                >
                    <Text style={styles.bannerBadge}>{userCommunity.community.badge}</Text>
                    <Text style={styles.bannerText}>
                        You're in {userCommunity.community.name}
                    </Text>
                    <Text style={styles.bannerArrow}>→</Text>
                </TouchableOpacity>
            )}

            {/* Search Bar (Browse tab only) */}
            {activeTab === 'browse' && (
                <View style={styles.searchContainer}>
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search communities..."
                        value={searchTerm}
                        onChangeText={setSearchTerm}
                        onSubmitEditing={handleSearch}
                        autoCapitalize="none"
                    />
                    <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
                        <Text style={styles.searchButtonText}>Search</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Tabs */}
            <View style={styles.tabs}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'browse' && styles.activeTab]}
                    onPress={() => setActiveTab('browse')}
                >
                    <Text style={[styles.tabText, activeTab === 'browse' && styles.activeTabText]}>
                        Browse ({communities.length})
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'invites' && styles.activeTab]}
                    onPress={() => setActiveTab('invites')}
                >
                    <Text style={[styles.tabText, activeTab === 'invites' && styles.activeTabText]}>
                        Invites ({invites.length})
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'requests' && styles.activeTab]}
                    onPress={() => setActiveTab('requests')}
                >
                    <Text style={[styles.tabText, activeTab === 'requests' && styles.activeTabText]}>
                        Requests ({requests.length})
                    </Text>
                </TouchableOpacity>
            </View>

            {/* List */}
            {loading ? (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                </View>
            ) : (
                <FlatList
                    data={
                        activeTab === 'browse' ? communities :
                            activeTab === 'invites' ? invites :
                                requests as any[]
                    }
                    renderItem={({ item }) => {
                        if (activeTab === 'browse') {
                            return renderCommunityItem({ item: item as Community });
                        } else if (activeTab === 'invites') {
                            return renderInviteItem({ item: item as CommunityInvite });
                        } else {
                            return renderRequestItem({ item: item as JoinRequest });
                        }
                    }}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>
                                {activeTab === 'browse' ? 'No communities found' :
                                    activeTab === 'invites' ? 'No pending invites' :
                                        'No pending requests'}
                            </Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FAFAFA',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 12,
        backgroundColor: COLORS.background,
    },
    backButton: {
        backgroundColor: COLORS.white,
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    backButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.textPrimary,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: COLORS.textPrimary,
    },
    createButton: {
        backgroundColor: COLORS.primary,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
    },
    createButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 14,
    },
    userCommunityBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.primaryLight,
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
    },
    bannerBadge: {
        fontSize: 24,
        marginRight: 12,
    },
    bannerText: {
        flex: 1,
        fontSize: 16,
        color: '#333',
        fontWeight: '600',
    },
    bannerArrow: {
        fontSize: 20,
        color: COLORS.primary,
    },
    searchContainer: {
        flexDirection: 'row',
        padding: 16,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
    },
    searchInput: {
        flex: 1,
        height: 44,
        borderWidth: 1,
        borderColor: '#DDD',
        borderRadius: 8,
        paddingHorizontal: 16,
        marginRight: 12,
        fontSize: 16,
        backgroundColor: '#F9F9F9',
    },
    searchButton: {
        backgroundColor: COLORS.primary,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 8,
        justifyContent: 'center',
    },
    searchButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 14,
    },
    tabs: {
        flexDirection: 'row',
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
    },
    tab: {
        flex: 1,
        paddingVertical: 16,
        alignItems: 'center',
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    activeTab: {
        borderBottomColor: COLORS.primary,
    },
    tabText: {
        fontSize: 14,
        color: '#666',
        fontWeight: '600',
    },
    activeTabText: {
        color: COLORS.primary,
    },
    listContent: {
        padding: 16,
    },
    card: {
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    cardHeader: {
        flexDirection: 'row',
        marginBottom: 12,
    },
    badge: {
        fontSize: 40,
        marginRight: 12,
    },
    cardInfo: {
        flex: 1,
    },
    communityName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 4,
    },
    communityMeta: {
        fontSize: 13,
        color: '#666',
        marginBottom: 4,
    },
    description: {
        fontSize: 14,
        color: '#666',
        marginTop: 4,
        marginBottom: 4,
    },
    leader: {
        fontSize: 13,
        color: '#888',
        marginTop: 4,
    },
    inviteFrom: {
        fontSize: 14,
        color: '#333',
        marginTop: 4,
    },
    statusPending: {
        fontSize: 13,
        color: '#FFA500',
        fontWeight: '600',
        marginTop: 4,
    },
    timeAgo: {
        fontSize: 12,
        color: '#999',
        marginTop: 4,
    },
    actionButton: {
        backgroundColor: COLORS.primary,
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    actionButtons: {
        flexDirection: 'row',
        gap: 12,
    },
    acceptButton: {
        flex: 1,
        backgroundColor: COLORS.primary,
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    rejectButton: {
        flex: 1,
        backgroundColor: '#F5F5F5',
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#DDD',
    },
    actionButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 14,
    },
    rejectButtonText: {
        color: '#666',
        fontWeight: 'bold',
        fontSize: 14,
    },
    disabledButton: {
        backgroundColor: '#CCC',
        opacity: 0.6,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyContainer: {
        paddingVertical: 60,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 16,
        color: '#999',
    },
});
