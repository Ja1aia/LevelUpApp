import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    ScrollView,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { COLORS } from '../theme/colors';
import { supabase } from '../lib/supabase';
import {
    getUserCommunity,
    getCommunityDetails,
    leaveCommunity,
    createRoom,
    createGameInvite,
    getCommunityTournaments,
    registerForTournament,
    unregisterFromTournament,
    getCommunityStats,
} from '../services/database';
import { generateRoomCode } from '../utils/roomCode';

interface CommunityHubScreenProps {
    userId: string;
    username: string;
    onBack: () => void;
    onManageCommunity: () => void;
    onCreateTournament: (communityId: string, communityName: string) => void;
    onViewTournament: (tournamentId: string) => void;
    onRoomCreated: (roomId: string, roomCode: string) => void;
}

interface Member {
    membershipId: string;
    id: string;
    username: string;
    elo: number;
    avatar: string;
    role: string;
    joined_at: string;
}

interface CommunityData {
    id: string;
    name: string;
    description: string;
    badge: string;
    leader_id: string;
    member_count: number;
    max_members: number;
    visibility: string;
    created_at: string;
    members: Member[];
}

interface Tournament {
    id: string;
    name: string;
    format: string;
    status: string;
    min_participants: number;
    max_participants: number;
    current_participants: number;
    created_at: string;
    is_registered?: boolean;
}

export default function CommunityHubScreen({
    userId,
    username,
    onBack,
    onManageCommunity,
    onCreateTournament,
    onViewTournament,
    onRoomCreated,
}: CommunityHubScreenProps) {
    const [activeTab, setActiveTab] = useState<'members' | 'tournaments' | 'stats'>('members');
    const [community, setCommunity] = useState<CommunityData | null>(null);
    const [tournaments, setTournaments] = useState<Tournament[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [userRole, setUserRole] = useState<string>('member');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [challenging, setChallenging] = useState<string | null>(null);
    const [processingTournament, setProcessingTournament] = useState<string | null>(null);

    useEffect(() => {
        fetchData();
    }, [userId]);

    // Real-time subscriptions for live updates
    useEffect(() => {
        if (!community) return;

        const communityChannel = supabase
            .channel(`community-hub-${community.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'tournaments',
                    filter: `community_id=eq.${community.id}`
                },
                (payload) => {
                    console.log('Tournament updated:', payload);
                    fetchData();
                }
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'community_members',
                    filter: `community_id=eq.${community.id}`
                },
                (payload) => {
                    console.log('Member updated:', payload);
                    fetchData();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(communityChannel);
        };
    }, [community?.id]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Get user's community membership
            const { data: membership } = await getUserCommunity(userId);
            if (!membership || !membership.community) {
                Alert.alert('Error', 'You are not in a community');
                onBack();
                return;
            }

            setUserRole(membership.role);

            // Get full community details with members
            const { data: details, error } = await getCommunityDetails(membership.community.id);
            if (error) throw error;

            setCommunity(details);

            // Get tournaments
            const { data: tournamentsData } = await getCommunityTournaments(membership.community.id, userId);
            setTournaments(tournamentsData || []);

            // Get stats
            const { data: statsData } = await getCommunityStats(membership.community.id);
            if (statsData) {
                // Format nested data
                const formattedStats = {
                    ...statsData,
                    topMembers: statsData.topMembers.map((m: any) => ({
                        ...m,
                        user: Array.isArray(m.user) ? m.user[0] : m.user
                    })),
                    recentChampions: statsData.recentChampions.map((c: any) => ({
                        ...c,
                        winner: Array.isArray(c.winner) ? c.winner[0] : c.winner
                    }))
                };
                setStats(formattedStats);
            }
        } catch (error) {
            console.error('Error fetching community:', error);
            Alert.alert('Error', 'Failed to load community');
        } finally {
            setLoading(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchData();
        setRefreshing(false);
    };

    const handleChallenge = async (friendId: string, friendName: string) => {
        setChallenging(friendId);
        try {
            // Create room
            const roomCode = generateRoomCode();
            const { data: room, error: roomError } = await createRoom(userId, roomCode);
            if (roomError || !room) throw roomError;

            // Send invite
            const { error: inviteError } = await createGameInvite(userId, friendId, room.id);
            if (inviteError) throw inviteError;

            Alert.alert('Challenge Sent!', `Challenge sent to ${friendName}`);
            onRoomCreated(room.id, roomCode);
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to send challenge');
        } finally {
            setChallenging(null);
        }
    };

    const handleLeave = () => {
        if (userRole === 'leader') {
            Alert.alert(
                'Cannot Leave',
                'Leaders cannot leave. Transfer leadership or disband the community first.',
                [{ text: 'OK' }]
            );
            return;
        }

        Alert.alert(
            'Leave Community',
            `Are you sure you want to leave ${community?.name}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Leave',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const { error } = await leaveCommunity(userId);
                            if (error) throw error;

                            Alert.alert('Left Community', 'You have left the community');
                            onBack();
                        } catch (error: any) {
                            Alert.alert('Error', error.message || 'Failed to leave community');
                        }
                    }
                }
            ]
        );
    };

    const handleRegisterTournament = async (tournamentId: string, tournamentName: string) => {
        setProcessingTournament(tournamentId);
        try {
            const { error } = await registerForTournament(tournamentId, userId); // tournamentId, userId
            if (error) throw error;

            Alert.alert('Registered!', `You are now registered for "${tournamentName}"`);
            await fetchData();
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to register');
        } finally {
            setProcessingTournament(null);
        }
    };

    const handleUnregisterTournament = async (tournamentId: string, tournamentName: string) => {
        Alert.alert(
            'Unregister',
            `Are you sure you want to unregister from "${tournamentName}"?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Unregister',
                    style: 'destructive',
                    onPress: async () => {
                        setProcessingTournament(tournamentId);
                        try {
                            const { error } = await unregisterFromTournament(tournamentId, userId); // tournamentId, userId
                            if (error) throw error;

                            await fetchData();
                        } catch (error: any) {
                            Alert.alert('Error', error.message || 'Failed to unregister');
                        } finally {
                            setProcessingTournament(null);
                        }
                    }
                }
            ]
        );
    };

    const renderTournamentItem = ({ item }: { item: Tournament }) => {
        const isProcessing = processingTournament === item.id;
        const isFull = item.current_participants >= item.max_participants;
        const canStart = item.current_participants >= item.min_participants;

        const getStatusLabel = () => {
            if (item.status === 'completed') return '🏆 Completed';
            if (item.status === 'in_progress') return '⚔️ In Progress';
            if (canStart) return '✅ Ready to Start';
            return '📝 Registration Open';
        };

        const getStatusColor = () => {
            if (item.status === 'completed') return '#FFD700';
            if (item.status === 'in_progress') return '#FF6B6B';
            if (canStart) return COLORS.primary;
            return '#999';
        };

        return (
            <View style={styles.tournamentCard}>
                <View style={styles.tournamentHeader}>
                    <Text style={styles.tournamentName}>{item.name}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor() }]}>
                        <Text style={styles.statusText}>{getStatusLabel()}</Text>
                    </View>
                </View>

                <Text style={styles.tournamentMeta}>
                    {item.format === 'single_elimination' ? '🏆 Single Elimination' : item.format}
                </Text>

                <Text style={styles.tournamentParticipants}>
                    Participants: {item.current_participants}/{item.max_participants}
                    {' '}(min: {item.min_participants})
                </Text>

                {item.status === 'registration' && (
                    <TouchableOpacity
                        style={[
                            styles.tournamentButton,
                            item.is_registered ? styles.unregisterButton : styles.registerButton,
                            (isProcessing || (isFull && !item.is_registered)) && styles.disabledButton
                        ]}
                        onPress={() => item.is_registered
                            ? handleUnregisterTournament(item.id, item.name)
                            : handleRegisterTournament(item.id, item.name)
                        }
                        disabled={isProcessing || (isFull && !item.is_registered)}
                    >
                        {isProcessing ? (
                            <ActivityIndicator color="white" size="small" />
                        ) : (
                            <Text style={item.is_registered ? styles.unregisterButtonText : styles.tournamentButtonText}>
                                {isFull && !item.is_registered ? 'Full' :
                                    item.is_registered ? 'Unregister' : 'Register'}
                            </Text>
                        )}
                    </TouchableOpacity>
                )}

                {item.status !== 'registration' && (
                    <TouchableOpacity
                        style={styles.viewBracketButton}
                        onPress={() => onViewTournament(item.id)}
                    >
                        <Text style={styles.viewBracketButtonText}>View Bracket</Text>
                    </TouchableOpacity>
                )}

                {item.status === 'registration' && item.is_registered && (
                    <TouchableOpacity
                        style={styles.viewBracketButton}
                        onPress={() => onViewTournament(item.id)}
                    >
                        <Text style={styles.viewBracketButtonText}>View Details</Text>
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    const renderMemberItem = ({ item }: { item: Member }) => {
        const isCurrentUser = item.id === userId;
        const canChallenge = !isCurrentUser;
        const isProcessing = challenging === item.id;

        return (
            <View style={styles.memberCard}>
                <Text style={styles.memberAvatar}>{item.avatar}</Text>
                <View style={styles.memberInfo}>
                    <View style={styles.memberHeader}>
                        <Text style={styles.memberName}>
                            {item.username} {isCurrentUser && '(You)'}
                        </Text>
                        {getRoleBadge(item.role)}
                    </View>
                    <Text style={styles.memberElo}>{item.elo} ELO</Text>
                </View>

                {canChallenge && (
                    <TouchableOpacity
                        style={[styles.challengeButton, isProcessing && styles.disabledButton]}
                        onPress={() => handleChallenge(item.id, item.username)}
                        disabled={isProcessing}
                    >
                        {isProcessing ? (
                            <ActivityIndicator color="white" size="small" />
                        ) : (
                            <Text style={styles.challengeButtonText}>⚔️</Text>
                        )}
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    const getRoleBadge = (role: string) => {
        switch (role) {
            case 'leader':
                return <View style={[styles.roleBadge, styles.leaderBadge]}><Text style={styles.roleBadgeText}>Leader</Text></View>;
            case 'co_leader':
                return <View style={[styles.roleBadge, styles.coLeaderBadge]}><Text style={styles.roleBadgeText}>Co-Leader</Text></View>;
            default:
                return null;
        }
    };

    const getVisibilityLabel = (visibility: string) => {
        switch (visibility) {
            case 'open': return '🌍 Open';
            case 'invite_only': return '🔒 Invite-Only';
            case 'closed': return '🚫 Closed';
            default: return visibility;
        }
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
        );
    }

    if (!community) {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={onBack} style={styles.backButton}>
                        <Text style={styles.backText}>←</Text>
                    </TouchableOpacity>
                    <Text style={styles.title}>Community</Text>
                    <View style={{ width: 40 }} />
                </View>
                <View style={styles.centerContainer}>
                    <Text style={styles.errorText}>Community not found</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.backButton}>
                    <Text style={styles.backText}>←</Text>
                </TouchableOpacity>
                <Text style={styles.title}>Community</Text>
                {(userRole === 'leader' || userRole === 'co_leader') && (
                    <TouchableOpacity onPress={onManageCommunity} style={styles.manageButton}>
                        <Text style={styles.manageButtonText}>Manage</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Community Info Banner */}
            <View style={styles.infoBanner}>
                <Text style={styles.infoBadge}>{community.badge}</Text>
                <View style={styles.infoContent}>
                    <Text style={styles.infoName}>{community.name}</Text>
                    <Text style={styles.infoMeta}>
                        {community.member_count}/{community.max_members} members • {getVisibilityLabel(community.visibility)}
                    </Text>
                    {community.description && (
                        <Text style={styles.infoDescription}>{community.description}</Text>
                    )}
                </View>
            </View>

            {/* Tabs */}
            <View style={styles.tabs}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'members' && styles.activeTab]}
                    onPress={() => setActiveTab('members')}
                >
                    <Text style={[styles.tabText, activeTab === 'members' && styles.activeTabText]}>
                        Members ({community.members.length})
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'tournaments' && styles.activeTab]}
                    onPress={() => setActiveTab('tournaments')}
                >
                    <Text style={[styles.tabText, activeTab === 'tournaments' && styles.activeTabText]}>
                        Tournaments ({tournaments.length})
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'stats' && styles.activeTab]}
                    onPress={() => setActiveTab('stats')}
                >
                    <Text style={[styles.tabText, activeTab === 'stats' && styles.activeTabText]}>
                        Stats
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Members List */}
            {activeTab === 'members' && (
                <FlatList
                    data={community.members}
                    renderItem={renderMemberItem}
                    keyExtractor={(item) => item.membershipId}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                    }
                />
            )}

            {/* Tournaments List */}
            {activeTab === 'tournaments' && (
                <>
                    {(userRole === 'leader' || userRole === 'co_leader') && (
                        <View style={styles.createTournamentSection}>
                            <TouchableOpacity
                                style={styles.createTournamentButton}
                                onPress={() => onCreateTournament(community.id, community.name)}
                            >
                                <Text style={styles.createTournamentButtonText}>+ Create Tournament</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                    <FlatList
                        data={tournaments}
                        renderItem={renderTournamentItem}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={styles.listContent}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                        }
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Text style={styles.emptyText}>No tournaments yet</Text>
                                {(userRole === 'leader' || userRole === 'co_leader') && (
                                    <Text style={styles.emptySubtext}>Create one to get started!</Text>
                                )}
                            </View>
                        }
                    />
                </>
            )}

            {/* Stats Tab */}
            {activeTab === 'stats' && stats && (
                <ScrollView
                    style={styles.statsContainer}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                >
                    {/* Overview Cards */}
                    <View style={styles.statsOverview}>
                        <View style={styles.statCard}>
                            <Text style={styles.statValue}>{community.member_count}</Text>
                            <Text style={styles.statLabel}>Members</Text>
                        </View>
                        <View style={styles.statCard}>
                            <Text style={styles.statValue}>{stats.totalTournaments}</Text>
                            <Text style={styles.statLabel}>Tournaments</Text>
                        </View>
                        <View style={styles.statCard}>
                            <Text style={styles.statValue}>{stats.completedTournaments}</Text>
                            <Text style={styles.statLabel}>Completed</Text>
                        </View>
                    </View>

                    {/* Top Members */}
                    <View style={styles.statsSection}>
                        <Text style={styles.statsSectionTitle}>🏆 Top Members by ELO</Text>
                        {stats.topMembers.map((member: any, index: number) => (
                            <View key={member.user_id} style={styles.topMemberRow}>
                                <Text style={styles.topMemberRank}>#{index + 1}</Text>
                                <Text style={styles.topMemberAvatar}>{member.user.avatar}</Text>
                                <View style={styles.topMemberInfo}>
                                    <Text style={styles.topMemberName}>{member.user.username}</Text>
                                    <Text style={styles.topMemberStats}>
                                        {member.user.wins}W - {member.user.total_games - member.user.wins}L
                                    </Text>
                                </View>
                                <Text style={styles.topMemberElo}>{member.user.elo}</Text>
                            </View>
                        ))}
                    </View>

                    {/* Recent Champions */}
                    {stats.recentChampions.length > 0 && (
                        <View style={styles.statsSection}>
                            <Text style={styles.statsSectionTitle}>👑 Recent Champions</Text>
                            {stats.recentChampions.map((tournament: any) => (
                                <View key={tournament.id} style={styles.championRow}>
                                    <Text style={styles.championTrophy}>🏆</Text>
                                    <View style={styles.championInfo}>
                                        <Text style={styles.championTournament}>{tournament.name}</Text>
                                        <Text style={styles.championWinner}>
                                            {tournament.winner?.username || 'Unknown'}
                                        </Text>
                                    </View>
                                    <Text style={styles.championDate}>
                                        {new Date(tournament.completed_at).toLocaleDateString()}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    )}

                    <View style={{ height: 20 }} />
                </ScrollView>
            )}

            {/* Bottom Actions */}
            <View style={styles.bottomActions}>
                <TouchableOpacity
                    style={[styles.leaveButton, userRole === 'leader' && styles.disabledButton]}
                    onPress={handleLeave}
                    disabled={userRole === 'leader'}
                >
                    <Text style={styles.leaveButtonText}>
                        {userRole === 'leader' ? 'Cannot Leave (Leader)' : 'Leave Community'}
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FAFAFA',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FAFAFA',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 16,
        paddingBottom: 20,
        paddingHorizontal: 20,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
    },
    backButton: {
        padding: 8,
    },
    backText: {
        fontSize: 28,
        color: COLORS.primary,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333',
    },
    manageButton: {
        backgroundColor: COLORS.primary,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
    },
    manageButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 14,
    },
    infoBanner: {
        flexDirection: 'row',
        padding: 20,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
    },
    infoBadge: {
        fontSize: 50,
        marginRight: 16,
    },
    infoContent: {
        flex: 1,
    },
    infoName: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 6,
    },
    infoMeta: {
        fontSize: 14,
        color: '#666',
        marginBottom: 8,
    },
    infoDescription: {
        fontSize: 14,
        color: '#666',
        lineHeight: 20,
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
    disabledTabText: {
        color: '#CCC',
    },
    listContent: {
        padding: 16,
    },
    memberCard: {
        flexDirection: 'row',
        alignItems: 'center',
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
    memberAvatar: {
        fontSize: 40,
        marginRight: 12,
    },
    memberInfo: {
        flex: 1,
    },
    memberHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    memberName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
        marginRight: 8,
    },
    roleBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    leaderBadge: {
        backgroundColor: '#FFD700',
    },
    coLeaderBadge: {
        backgroundColor: '#C0C0C0',
    },
    roleBadgeText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#333',
    },
    memberElo: {
        fontSize: 14,
        color: '#666',
    },
    challengeButton: {
        backgroundColor: COLORS.primary,
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
    challengeButtonText: {
        fontSize: 20,
    },
    disabledButton: {
        backgroundColor: '#CCC',
        opacity: 0.6,
    },
    bottomActions: {
        padding: 16,
        backgroundColor: 'white',
        borderTopWidth: 1,
        borderTopColor: '#E0E0E0',
    },
    leaveButton: {
        backgroundColor: '#F5F5F5',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#DDD',
    },
    leaveButtonText: {
        color: '#666',
        fontWeight: 'bold',
        fontSize: 14,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    errorText: {
        fontSize: 16,
        color: '#999',
    },
    comingSoonContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    comingSoonText: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#999',
        marginBottom: 8,
    },
    comingSoonSubtext: {
        fontSize: 14,
        color: '#BBB',
    },
    createTournamentSection: {
        padding: 16,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
    },
    createTournamentButton: {
        backgroundColor: COLORS.primary,
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    createTournamentButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 14,
    },
    tournamentCard: {
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
    tournamentHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    tournamentName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        flex: 1,
        marginRight: 12,
    },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
    },
    statusText: {
        color: 'white',
        fontSize: 11,
        fontWeight: 'bold',
    },
    tournamentMeta: {
        fontSize: 14,
        color: '#666',
        marginBottom: 6,
    },
    tournamentParticipants: {
        fontSize: 13,
        color: '#888',
        marginBottom: 12,
    },
    tournamentButton: {
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 4,
    },
    registerButton: {
        backgroundColor: COLORS.primary,
    },
    unregisterButton: {
        backgroundColor: '#F5F5F5',
        borderWidth: 1,
        borderColor: '#DDD',
    },
    tournamentButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 14,
    },
    unregisterButtonText: {
        color: '#666',
        fontWeight: 'bold',
        fontSize: 14,
    },
    viewBracketButton: {
        backgroundColor: '#F5F5F5',
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 4,
        borderWidth: 1,
        borderColor: '#DDD',
    },
    viewBracketButtonText: {
        color: '#666',
        fontWeight: 'bold',
        fontSize: 14,
    },
    emptyContainer: {
        paddingVertical: 60,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 16,
        color: '#999',
        marginBottom: 8,
    },
    emptySubtext: {
        fontSize: 14,
        color: '#BBB',
    },
    statsContainer: {
        flex: 1,
    },
    statsOverview: {
        flexDirection: 'row',
        padding: 16,
        backgroundColor: 'white',
        gap: 12,
    },
    statCard: {
        flex: 1,
        backgroundColor: COLORS.primaryLight,
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.primary,
    },
    statValue: {
        fontSize: 28,
        fontWeight: 'bold',
        color: COLORS.primaryDark,
        marginBottom: 4,
    },
    statLabel: {
        fontSize: 12,
        color: '#666',
        textTransform: 'uppercase',
        fontWeight: '600',
    },
    statsSection: {
        backgroundColor: 'white',
        padding: 20,
        marginTop: 12,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#E0E0E0',
    },
    statsSectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 16,
    },
    topMemberRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    topMemberRank: {
        fontSize: 16,
        fontWeight: 'bold',
        color: COLORS.primary,
        width: 40,
    },
    topMemberAvatar: {
        fontSize: 24,
        marginRight: 12,
    },
    topMemberInfo: {
        flex: 1,
    },
    topMemberName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 2,
    },
    topMemberStats: {
        fontSize: 12,
        color: '#888',
    },
    topMemberElo: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.primaryDark,
    },
    championRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    championTrophy: {
        fontSize: 24,
        marginRight: 12,
    },
    championInfo: {
        flex: 1,
    },
    championTournament: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 2,
    },
    championWinner: {
        fontSize: 14,
        color: '#666',
    },
    championDate: {
        fontSize: 12,
        color: '#999',
    },
});
