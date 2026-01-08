import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Alert,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { COLORS } from '../theme/colors';
import {
    getUserCommunity,
    getCommunityDetails,
    getJoinRequests,
    approveJoinRequest,
    rejectJoinRequest,
    kickMember,
    promoteToCoLeader,
    demoteCoLeader,
    updateCommunitySettings,
    disbandCommunity,
} from '../services/database';

interface CommunityManagementScreenProps {
    userId: string;
    onBack: () => void;
}

interface JoinRequest {
    id: string;
    created_at: string;
    message: string;
    requester: {
        id: string;
        username: string;
        elo: number;
        avatar: string;
    } | {
        id: string;
        username: string;
        elo: number;
        avatar: string;
    }[];
}

interface Member {
    membershipId: string;
    id: string;
    username: string;
    elo: number;
    avatar: string;
    role: string;
}

export default function CommunityManagementScreen({
    userId,
    onBack,
}: CommunityManagementScreenProps) {
    const [community, setCommunity] = useState<any>(null);
    const [userRole, setUserRole] = useState<string>('member');
    const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [processing, setProcessing] = useState<string | null>(null);

    // Settings editing state
    const [editingSettings, setEditingSettings] = useState(false);
    const [editName, setEditName] = useState('');
    const [editDescription, setEditDescription] = useState('');
    const [editMaxMembers, setEditMaxMembers] = useState('');
    const [editVisibility, setEditVisibility] = useState<'open' | 'invite_only' | 'closed'>('open');

    useEffect(() => {
        fetchData();
    }, [userId]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const { data: membership } = await getUserCommunity(userId);
            if (!membership || !membership.community) {
                Alert.alert('Error', 'You are not in a community');
                onBack();
                return;
            }

            setUserRole(membership.role);

            if (membership.role !== 'leader' && membership.role !== 'co_leader') {
                Alert.alert('Access Denied', 'Only leaders and co-leaders can manage the community');
                onBack();
                return;
            }

            const { data: details } = await getCommunityDetails(membership.community.id);
            setCommunity(details);

            // Initialize editing state
            if (details) {
                setEditName(details.name);
                setEditDescription(details.description || '');
                setEditMaxMembers(details.max_members.toString());
                setEditVisibility(details.visibility);
            }

            // Fetch join requests
            if (details && details.visibility === 'invite_only') {
                const { data: requests } = await getJoinRequests(details.id);
                const formattedRequests = (requests || []).map((item: any) => ({
                    ...item,
                    requester: Array.isArray(item.requester) ? item.requester[0] : item.requester
                }));
                setJoinRequests(formattedRequests);
            }
        } catch (error) {
            console.error('Error fetching data:', error);
            Alert.alert('Error', 'Failed to load community data');
        } finally {
            setLoading(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchData();
        setRefreshing(false);
    };

    const handleApproveRequest = async (requestId: string, requesterId: string) => {
        setProcessing(requestId);
        try {
            const { error } = await approveJoinRequest(requestId, userId); // requestId, approverId
            if (error) throw error;

            Alert.alert('Success', 'Join request approved');
            await fetchData();
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to approve request');
        } finally {
            setProcessing(null);
        }
    };

    const handleRejectRequest = async (requestId: string) => {
        setProcessing(requestId);
        try {
            const { error } = await rejectJoinRequest(requestId, userId); // requestId, rejecterId
            if (error) throw error;

            await fetchData();
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to reject request');
        } finally {
            setProcessing(null);
        }
    };

    const handleKickMember = async (memberId: string, memberName: string) => {
        Alert.alert(
            'Kick Member',
            `Are you sure you want to kick ${memberName} from the community?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Kick',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const { error } = await kickMember(memberId, userId); // membershipId, kickerId
                            if (error) throw error;

                            Alert.alert('Success', `${memberName} has been removed from the community`);
                            await fetchData();
                        } catch (error: any) {
                            Alert.alert('Error', error.message || 'Failed to kick member');
                        }
                    }
                }
            ]
        );
    };

    const handlePromote = async (memberId: string, memberName: string) => {
        Alert.alert(
            'Promote to Co-Leader',
            `Promote ${memberName} to co-leader? They will be able to manage members and tournaments.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Promote',
                    onPress: async () => {
                        try {
                            const { error } = await promoteToCoLeader(memberId, userId); // membershipId, leaderId
                            if (error) throw error;

                            Alert.alert('Success', `${memberName} is now a co-leader`);
                            await fetchData();
                        } catch (error: any) {
                            Alert.alert('Error', error.message || 'Failed to promote member');
                        }
                    }
                }
            ]
        );
    };

    const handleDemote = async (memberId: string, memberName: string) => {
        Alert.alert(
            'Demote Co-Leader',
            `Demote ${memberName} back to regular member?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Demote',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const { error } = await demoteCoLeader(memberId, userId); // membershipId, leaderId
                            if (error) throw error;

                            Alert.alert('Success', `${memberName} is now a regular member`);
                            await fetchData();
                        } catch (error: any) {
                            Alert.alert('Error', error.message || 'Failed to demote co-leader');
                        }
                    }
                }
            ]
        );
    };

    const handleSaveSettings = async () => {
        if (!editName.trim()) {
            Alert.alert('Error', 'Community name cannot be empty');
            return;
        }

        if (editName.length < 3 || editName.length > 30) {
            Alert.alert('Error', 'Community name must be 3-30 characters');
            return;
        }

        const maxMembersNum = parseInt(editMaxMembers);
        if (isNaN(maxMembersNum) || maxMembersNum < 10 || maxMembersNum > 100) {
            Alert.alert('Error', 'Max members must be between 10 and 100');
            return;
        }

        if (maxMembersNum < community.member_count) {
            Alert.alert('Error', `Cannot set max members below current member count (${community.member_count})`);
            return;
        }

        setProcessing('settings');
        try {
            const { error } = await updateCommunitySettings(
                community.id,
                userId,
                {
                    name: editName.trim(),
                    description: editDescription.trim(),
                    max_members: maxMembersNum,
                    visibility: editVisibility
                }
            );
            if (error) throw error;

            Alert.alert('Success', 'Community settings updated');
            setEditingSettings(false);
            await fetchData();
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to update settings');
        } finally {
            setProcessing(null);
        }
    };

    const handleDisband = () => {
        Alert.alert(
            'Disband Community',
            `Are you sure you want to disband ${community.name}? This action cannot be undone. All members will be removed.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Disband',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const { error } = await disbandCommunity(community.id, userId); // communityId, userId
                            if (error) throw error;

                            Alert.alert('Community Disbanded', 'The community has been disbanded');
                            onBack();
                        } catch (error: any) {
                            Alert.alert('Error', error.message || 'Failed to disband community');
                        }
                    }
                }
            ]
        );
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
                        <Text style={styles.backButtonText}>Back</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Manage Community</Text>
                    <View style={styles.headerSpacer} />
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
                    <Text style={styles.backButtonText}>Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Manage Community</Text>
                <View style={styles.headerSpacer} />
            </View>

            <ScrollView
                style={styles.content}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                {/* Settings Section (Leaders Only) */}
                {userRole === 'leader' && (
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>⚙️ Community Settings</Text>
                            {!editingSettings ? (
                                <TouchableOpacity onPress={() => setEditingSettings(true)}>
                                    <Text style={styles.editButton}>Edit</Text>
                                </TouchableOpacity>
                            ) : (
                                <View style={styles.editActions}>
                                    <TouchableOpacity onPress={() => {
                                        setEditingSettings(false);
                                        setEditName(community.name);
                                        setEditDescription(community.description || '');
                                        setEditMaxMembers(community.max_members.toString());
                                        setEditVisibility(community.visibility);
                                    }}>
                                        <Text style={styles.cancelButton}>Cancel</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={handleSaveSettings}
                                        disabled={processing === 'settings'}
                                    >
                                        <Text style={styles.saveButton}>
                                            {processing === 'settings' ? 'Saving...' : 'Save'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>

                        {editingSettings ? (
                            <>
                                <View style={styles.inputGroup}>
                                    <Text style={styles.label}>Name</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={editName}
                                        onChangeText={setEditName}
                                        maxLength={30}
                                    />
                                    <Text style={styles.helperText}>{editName.length}/30</Text>
                                </View>

                                <View style={styles.inputGroup}>
                                    <Text style={styles.label}>Description</Text>
                                    <TextInput
                                        style={[styles.input, styles.textArea]}
                                        value={editDescription}
                                        onChangeText={setEditDescription}
                                        multiline
                                        numberOfLines={3}
                                        maxLength={200}
                                    />
                                    <Text style={styles.helperText}>{editDescription.length}/200</Text>
                                </View>

                                <View style={styles.inputGroup}>
                                    <Text style={styles.label}>Max Members</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={editMaxMembers}
                                        onChangeText={setEditMaxMembers}
                                        keyboardType="number-pad"
                                        maxLength={3}
                                    />
                                    <Text style={styles.helperText}>10-100 (current: {community.member_count})</Text>
                                </View>

                                <View style={styles.inputGroup}>
                                    <Text style={styles.label}>Visibility</Text>
                                    {['open', 'invite_only', 'closed'].map((vis) => (
                                        <TouchableOpacity
                                            key={vis}
                                            style={[
                                                styles.visibilityOption,
                                                editVisibility === vis && styles.visibilityOptionSelected
                                            ]}
                                            onPress={() => setEditVisibility(vis as any)}
                                        >
                                            <View style={styles.radioOuter}>
                                                {editVisibility === vis && <View style={styles.radioInner} />}
                                            </View>
                                            <Text style={styles.visibilityText}>
                                                {vis === 'open' ? '🌍 Open' :
                                                    vis === 'invite_only' ? '🔒 Invite-Only' :
                                                        '🚫 Closed'}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </>
                        ) : (
                            <View style={styles.settingsDisplay}>
                                <Text style={styles.settingItem}>Name: {community.name}</Text>
                                <Text style={styles.settingItem}>
                                    Description: {community.description || '(none)'}
                                </Text>
                                <Text style={styles.settingItem}>
                                    Max Members: {community.max_members}
                                </Text>
                                <Text style={styles.settingItem}>
                                    Visibility: {
                                        community.visibility === 'open' ? '🌍 Open' :
                                            community.visibility === 'invite_only' ? '🔒 Invite-Only' :
                                                '🚫 Closed'
                                    }
                                </Text>
                            </View>
                        )}
                    </View>
                )}

                {/* Join Requests Section (Invite-Only Communities) */}
                {community.visibility === 'invite_only' && joinRequests.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>📬 Join Requests ({joinRequests.length})</Text>
                        {joinRequests.map((request) => {
                            const requester = request.requester as any;
                            return (
                                <View key={request.id} style={styles.requestCard}>
                                    <Text style={styles.requestAvatar}>{requester.avatar}</Text>
                                    <View style={styles.requestInfo}>
                                        <Text style={styles.requestName}>{requester.username}</Text>
                                        <Text style={styles.requestElo}>{requester.elo} ELO</Text>
                                        {request.message && (
                                            <Text style={styles.requestMessage}>"{request.message}"</Text>
                                        )}
                                    </View>
                                    <View style={styles.requestActions}>
                                        <TouchableOpacity
                                            style={[styles.approveButton, processing === request.id && styles.disabledButton]}
                                            onPress={() => handleApproveRequest(request.id, requester.id)}
                                            disabled={processing === request.id}
                                        >
                                            <Text style={styles.approveButtonText}>✓</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.rejectButton, processing === request.id && styles.disabledButton]}
                                            onPress={() => handleRejectRequest(request.id)}
                                            disabled={processing === request.id}
                                        >
                                            <Text style={styles.rejectButtonText}>✕</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                )}

                {/* Members Management Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>👥 Manage Members ({community.members.length})</Text>
                    {community.members.map((member: Member) => {
                        const isCurrentUser = member.id === userId;
                        const isLeader = member.role === 'leader';
                        const isCoLeader = member.role === 'co_leader';
                        const canKick = (userRole === 'leader' && !isLeader) ||
                            (userRole === 'co_leader' && !isLeader && !isCoLeader);
                        const canPromote = userRole === 'leader' && !isLeader && !isCoLeader;
                        const canDemote = userRole === 'leader' && isCoLeader;

                        return (
                            <View key={member.membershipId} style={styles.memberCard}>
                                <Text style={styles.memberAvatar}>{member.avatar}</Text>
                                <View style={styles.memberInfo}>
                                    <View style={styles.memberHeader}>
                                        <Text style={styles.memberName}>
                                            {member.username} {isCurrentUser && '(You)'}
                                        </Text>
                                        {isLeader && (
                                            <View style={[styles.roleBadge, styles.leaderBadge]}>
                                                <Text style={styles.roleBadgeText}>Leader</Text>
                                            </View>
                                        )}
                                        {isCoLeader && (
                                            <View style={[styles.roleBadge, styles.coLeaderBadge]}>
                                                <Text style={styles.roleBadgeText}>Co-Leader</Text>
                                            </View>
                                        )}
                                    </View>
                                    <Text style={styles.memberElo}>{member.elo} ELO</Text>
                                </View>

                                {!isCurrentUser && (
                                    <View style={styles.memberActions}>
                                        {canPromote && (
                                            <TouchableOpacity
                                                style={styles.actionButton}
                                                onPress={() => handlePromote(member.id, member.username)}
                                            >
                                                <Text style={styles.actionButtonText}>⬆️</Text>
                                            </TouchableOpacity>
                                        )}
                                        {canDemote && (
                                            <TouchableOpacity
                                                style={styles.actionButton}
                                                onPress={() => handleDemote(member.id, member.username)}
                                            >
                                                <Text style={styles.actionButtonText}>⬇️</Text>
                                            </TouchableOpacity>
                                        )}
                                        {canKick && (
                                            <TouchableOpacity
                                                style={[styles.actionButton, styles.kickButton]}
                                                onPress={() => handleKickMember(member.id, member.username)}
                                            >
                                                <Text style={styles.actionButtonText}>🚫</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                )}
                            </View>
                        );
                    })}
                </View>

                {/* Danger Zone (Leaders Only) */}
                {userRole === 'leader' && (
                    <View style={[styles.section, styles.dangerSection]}>
                        <Text style={styles.dangerTitle}>⚠️ Danger Zone</Text>
                        <TouchableOpacity style={styles.disbandButton} onPress={handleDisband}>
                            <Text style={styles.disbandButtonText}>Disband Community</Text>
                        </TouchableOpacity>
                        <Text style={styles.dangerWarning}>
                            This will permanently delete the community and remove all members.
                        </Text>
                    </View>
                )}

                <View style={{ height: 40 }} />
            </ScrollView>
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
    headerSpacer: {
        width: 60,
    },
    content: {
        flex: 1,
    },
    section: {
        backgroundColor: 'white',
        marginTop: 12,
        padding: 20,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#E0E0E0',
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 12,
    },
    editButton: {
        color: COLORS.primary,
        fontWeight: 'bold',
        fontSize: 14,
    },
    editActions: {
        flexDirection: 'row',
        gap: 12,
    },
    cancelButton: {
        color: '#999',
        fontWeight: 'bold',
        fontSize: 14,
    },
    saveButton: {
        color: COLORS.primary,
        fontWeight: 'bold',
        fontSize: 14,
    },
    inputGroup: {
        marginBottom: 16,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
        marginBottom: 8,
    },
    input: {
        height: 44,
        borderWidth: 1,
        borderColor: '#DDD',
        borderRadius: 8,
        paddingHorizontal: 12,
        fontSize: 16,
        backgroundColor: '#F9F9F9',
    },
    textArea: {
        height: 80,
        paddingTop: 10,
        textAlignVertical: 'top',
    },
    helperText: {
        fontSize: 12,
        color: '#999',
        marginTop: 4,
    },
    visibilityOption: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: '#DDD',
        borderRadius: 8,
        marginBottom: 8,
    },
    visibilityOptionSelected: {
        borderColor: COLORS.primary,
        backgroundColor: COLORS.primaryLight,
    },
    radioOuter: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: '#DDD',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    radioInner: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: COLORS.primary,
    },
    visibilityText: {
        fontSize: 14,
        color: '#333',
        fontWeight: '600',
    },
    settingsDisplay: {
        gap: 8,
    },
    settingItem: {
        fontSize: 14,
        color: '#666',
        paddingVertical: 4,
    },
    requestCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#F9F9F9',
        borderRadius: 8,
        marginBottom: 12,
    },
    requestAvatar: {
        fontSize: 32,
        marginRight: 12,
    },
    requestInfo: {
        flex: 1,
    },
    requestName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
    },
    requestElo: {
        fontSize: 13,
        color: '#666',
        marginTop: 2,
    },
    requestMessage: {
        fontSize: 13,
        color: '#888',
        fontStyle: 'italic',
        marginTop: 4,
    },
    requestActions: {
        flexDirection: 'row',
        gap: 8,
    },
    approveButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: COLORS.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    approveButtonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
    rejectButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F5F5F5',
        borderWidth: 1,
        borderColor: '#DDD',
        justifyContent: 'center',
        alignItems: 'center',
    },
    rejectButtonText: {
        color: '#666',
        fontSize: 18,
        fontWeight: 'bold',
    },
    memberCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#F9F9F9',
        borderRadius: 8,
        marginBottom: 12,
    },
    memberAvatar: {
        fontSize: 32,
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
        fontSize: 14,
        fontWeight: 'bold',
        color: '#333',
        marginRight: 8,
    },
    roleBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    leaderBadge: {
        backgroundColor: '#FFD700',
    },
    coLeaderBadge: {
        backgroundColor: '#C0C0C0',
    },
    roleBadgeText: {
        fontSize: 9,
        fontWeight: 'bold',
        color: '#333',
    },
    memberElo: {
        fontSize: 13,
        color: '#666',
    },
    memberActions: {
        flexDirection: 'row',
        gap: 6,
    },
    actionButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: COLORS.primaryLight,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.primary,
    },
    kickButton: {
        backgroundColor: '#FFEBEE',
        borderColor: '#F44336',
    },
    actionButtonText: {
        fontSize: 14,
    },
    dangerSection: {
        borderWidth: 2,
        borderColor: '#F44336',
    },
    dangerTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#F44336',
        marginBottom: 12,
    },
    disbandButton: {
        backgroundColor: '#F44336',
        paddingVertical: 14,
        borderRadius: 8,
        alignItems: 'center',
        marginBottom: 12,
    },
    disbandButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 14,
    },
    dangerWarning: {
        fontSize: 12,
        color: '#999',
        textAlign: 'center',
    },
    disabledButton: {
        opacity: 0.5,
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
});
