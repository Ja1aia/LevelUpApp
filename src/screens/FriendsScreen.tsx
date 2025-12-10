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
    getFriends,
    getFriendRequests,
    sendFriendRequest,
    acceptFriendRequest,
    removeFriend,
    createRoom,
    createGameInvite,
    getGameInvites,
    respondToGameInvite,
    joinRoom,
} from '../services/database';
import { generateRoomCode } from '../utils/roomCode';

interface FriendsScreenProps {
    userId: string;
    username: string;
    onBack: () => void;
    onRoomCreated: (roomId: string, roomCode: string) => void;
    onRoomJoined: (roomId: string, roomCode: string) => void;
}

interface Friend {
    friendshipId: string;
    id: string;
    username: string;
    elo: number;
    avatar: string;
}

interface FriendRequest {
    id: string;
    user_id_1: string;
    created_at: string;
    sender: {
        id: string;
        username: string;
        elo: number;
        avatar: string;
    };
}

interface GameInvite {
    id: string;
    sender_id: string;
    room_id: string;
    created_at: string;
    sender: {
        id: string;
        username: string;
        elo: number;
        avatar: string;
    };
    room: {
        room_code: string;
    };
}

export default function FriendsScreen({
    userId,
    username,
    onBack,
    onRoomCreated,
    onRoomJoined
}: FriendsScreenProps) {
    const [activeTab, setActiveTab] = useState<'friends' | 'requests' | 'invites'>('friends');
    const [friends, setFriends] = useState<Friend[]>([]);
    const [requests, setRequests] = useState<FriendRequest[]>([]);
    const [invites, setInvites] = useState<GameInvite[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [addUsername, setAddUsername] = useState('');
    const [addingFriend, setAddingFriend] = useState(false);
    const [processingInvite, setProcessingInvite] = useState(false);

    useEffect(() => {
        fetchData();
    }, [userId]);

    const fetchData = async () => {
        setLoading(true);
        await Promise.all([fetchFriends(), fetchRequests(), fetchInvites()]);
        setLoading(false);
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await Promise.all([fetchFriends(), fetchRequests(), fetchInvites()]);
        setRefreshing(false);
    };

    const fetchFriends = async () => {
        const { data, error } = await getFriends(userId);
        if (!error && data) {
            setFriends(data);
        }
    };

    const fetchRequests = async () => {
        const { data, error } = await getFriendRequests(userId);
        if (!error && data) {
            const formattedRequests: FriendRequest[] = data.map((item: any) => ({
                id: item.id,
                user_id_1: item.user_id_1,
                created_at: item.created_at,
                sender: Array.isArray(item.sender) ? item.sender[0] : item.sender
            }));
            setRequests(formattedRequests);
        }
    };

    const fetchInvites = async () => {
        const { data, error } = await getGameInvites(userId);
        if (!error && data) {
            const formattedInvites: GameInvite[] = data.map((item: any) => ({
                id: item.id,
                sender_id: item.sender_id,
                room_id: item.room_id,
                created_at: item.created_at,
                sender: Array.isArray(item.sender) ? item.sender[0] : item.sender,
                room: Array.isArray(item.room) ? item.room[0] : item.room
            }));
            setInvites(formattedInvites);
        }
    };

    const handleAddFriend = async () => {
        if (!addUsername.trim()) return;

        setAddingFriend(true);
        const { error } = await sendFriendRequest(userId, addUsername.trim());
        setAddingFriend(false);

        if (error) {
            Alert.alert('Error', (error as Error).message || 'Failed to send friend request');
        } else {
            Alert.alert('Success', `Friend request sent to ${addUsername}`);
            setAddUsername('');
        }
    };

    const handleAccept = async (requestId: string) => {
        const { error } = await acceptFriendRequest(requestId);
        if (error) {
            Alert.alert('Error', 'Failed to accept request');
        } else {
            fetchData();
        }
    };

    const handleReject = async (requestId: string) => {
        const { error } = await removeFriend(requestId);
        if (error) {
            Alert.alert('Error', 'Failed to reject request');
        } else {
            fetchRequests();
        }
    };

    const handleRemoveFriend = (friendshipId: string, friendUsername: string) => {
        Alert.alert(
            'Remove Friend',
            `Are you sure you want to remove ${friendUsername}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                        const { error } = await removeFriend(friendshipId);
                        if (error) {
                            Alert.alert('Error', 'Failed to remove friend');
                        } else {
                            fetchFriends();
                        }
                    },
                },
            ]
        );
    };

    const handleChallenge = async (friendId: string, friendName: string) => {
        try {
            setProcessingInvite(true);
            // 1. Create Room
            const roomCode = generateRoomCode();
            const { data: room, error: roomError } = await createRoom(userId, roomCode);

            if (roomError || !room) {
                throw new Error('Failed to create room');
            }

            // 2. Create Invite
            const { error: inviteError } = await createGameInvite(userId, friendId, room.id);

            if (inviteError) {
                throw new Error('Failed to send invite');
            }

            // 3. Navigate to waiting screen
            onRoomCreated(room.id, roomCode);
        } catch (error) {
            console.error('Challenge error:', error);
            Alert.alert('Error', 'Failed to send challenge');
        } finally {
            setProcessingInvite(false);
        }
    };

    const handleAcceptInvite = async (invite: GameInvite) => {
        try {
            setProcessingInvite(true);
            // 1. Join Room
            const { data: room, error: joinError } = await joinRoom(invite.room.room_code, userId);

            if (joinError || !room) {
                Alert.alert('Error', 'Room is no longer available');
                await respondToGameInvite(invite.id, 'expired');
                fetchInvites();
                return;
            }

            // 2. Update Invite Status
            await respondToGameInvite(invite.id, 'accepted');

            // 3. Navigate to quiz
            onRoomJoined(room.id, invite.room.room_code);
        } catch (error) {
            console.error('Accept invite error:', error);
            Alert.alert('Error', 'Failed to join game');
        } finally {
            setProcessingInvite(false);
        }
    };

    const handleRejectInvite = async (inviteId: string) => {
        await respondToGameInvite(inviteId, 'rejected');
        fetchInvites();
    };

    const renderFriendItem = ({ item }: { item: Friend }) => (
        <View style={styles.card}>
            <View style={styles.avatarContainer}>
                <Text style={styles.avatarText}>{item.avatar}</Text>
            </View>
            <View style={styles.infoContainer}>
                <Text style={styles.username}>{item.username}</Text>
                <Text style={styles.elo}>{item.elo} ELO</Text>
            </View>
            <View style={styles.actionButtons}>
                <TouchableOpacity
                    style={styles.challengeButton}
                    onPress={() => handleChallenge(item.id, item.username)}
                    disabled={processingInvite}
                >
                    <Text style={styles.challengeButtonText}>⚔️</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => handleRemoveFriend(item.friendshipId, item.username)}
                >
                    <Text style={styles.removeButtonText}>🗑️</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    const renderRequestItem = ({ item }: { item: FriendRequest }) => (
        <View style={styles.card}>
            <View style={styles.avatarContainer}>
                <Text style={styles.avatarText}>{item.sender.avatar}</Text>
            </View>
            <View style={styles.infoContainer}>
                <Text style={styles.username}>{item.sender.username}</Text>
                <Text style={styles.elo}>{item.sender.elo} ELO</Text>
            </View>
            <View style={styles.actionButtons}>
                <TouchableOpacity
                    style={styles.acceptButton}
                    onPress={() => handleAccept(item.id)}
                >
                    <Text style={styles.acceptButtonText}>Accept</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.rejectButton}
                    onPress={() => handleReject(item.id)}
                >
                    <Text style={styles.rejectButtonText}>Reject</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    const renderInviteItem = ({ item }: { item: GameInvite }) => (
        <View style={styles.card}>
            <View style={styles.avatarContainer}>
                <Text style={styles.avatarText}>{item.sender.avatar}</Text>
            </View>
            <View style={styles.infoContainer}>
                <Text style={styles.username}>{item.sender.username}</Text>
                <Text style={[
                    styles.elo,
                    // @ts-ignore - room type definition needs update but runtime works
                    item.room?.tournament_match_id && { color: COLORS.primary, fontWeight: 'bold' }
                ]}>
                    {/* @ts-ignore */}
                    {item.room?.tournament_match_id ? '🏆 Tournament Match!' : 'Challenged you!'}
                </Text>
            </View>
            <View style={styles.actionButtons}>
                <TouchableOpacity
                    style={styles.acceptButton}
                    onPress={() => handleAcceptInvite(item)}
                    disabled={processingInvite}
                >
                    <Text style={styles.acceptButtonText}>Battle!</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.rejectButton}
                    onPress={() => handleRejectInvite(item.id)}
                    disabled={processingInvite}
                >
                    <Text style={styles.rejectButtonText}>Decline</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.backButton}>
                    <Text style={styles.backButtonText}>Back</Text>
                </TouchableOpacity>
                <Text style={styles.title}>Friends</Text>
                <View style={{ width: 40 }} />
            </View>

            {/* Add Friend Input */}
            <View style={styles.addSection}>
                <TextInput
                    style={styles.input}
                    placeholder="Add friend by username..."
                    value={addUsername}
                    onChangeText={setAddUsername}
                    autoCapitalize="none"
                />
                <TouchableOpacity
                    style={[styles.addButton, (!addUsername.trim() || addingFriend) && styles.disabledButton]}
                    onPress={handleAddFriend}
                    disabled={!addUsername.trim() || addingFriend}
                >
                    {addingFriend ? (
                        <ActivityIndicator color="white" size="small" />
                    ) : (
                        <Text style={styles.addButtonText}>Add</Text>
                    )}
                </TouchableOpacity>
            </View>

            {/* Tabs */}
            <View style={styles.tabs}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'friends' && styles.activeTab]}
                    onPress={() => setActiveTab('friends')}
                >
                    <Text style={[styles.tabText, activeTab === 'friends' && styles.activeTabText]}>
                        Friends ({friends.length})
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
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'invites' && styles.activeTab]}
                    onPress={() => setActiveTab('invites')}
                >
                    <Text style={[styles.tabText, activeTab === 'invites' && styles.activeTabText]}>
                        Invites ({invites.length})
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
                        activeTab === 'friends' ? friends :
                            activeTab === 'requests' ? requests :
                                invites as any[]
                    }
                    renderItem={({ item }) => {
                        if (activeTab === 'friends') {
                            return renderFriendItem({ item: item as Friend });
                        } else if (activeTab === 'requests') {
                            return renderRequestItem({ item: item as FriendRequest });
                        } else {
                            return renderInviteItem({ item: item as GameInvite });
                        }
                    }}
                    keyExtractor={(item) => item.id || (item as Friend).friendshipId}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>
                                {activeTab === 'friends' ? 'No friends yet' :
                                    activeTab === 'requests' ? 'No pending requests' :
                                        'No game invites'}
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
        paddingTop: 16,
        paddingBottom: 20,
        paddingHorizontal: 20,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
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
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
    },
    addSection: {
        flexDirection: 'row',
        padding: 16,
        backgroundColor: 'white',
        marginBottom: 8,
    },
    input: {
        flex: 1,
        backgroundColor: '#F5F5F5',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginRight: 10,
        fontSize: 16,
    },
    addButton: {
        backgroundColor: COLORS.primary,
        borderRadius: 8,
        paddingHorizontal: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    disabledButton: {
        opacity: 0.5,
    },
    addButtonText: {
        color: '#1A1A1A',
        fontWeight: 'bold',
    },
    tabs: {
        flexDirection: 'row',
        backgroundColor: 'white',
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
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
        color: '#888',
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
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    avatarContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#E8F4FD',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    avatarText: {
        fontSize: 24,
    },
    infoContainer: {
        flex: 1,
    },
    username: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
    },
    elo: {
        fontSize: 14,
        color: '#888',
    },
    actionButtons: {
        flexDirection: 'row',
        gap: 8,
        alignItems: 'center',
    },
    challengeButton: {
        backgroundColor: '#F0F0F0',
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    challengeButtonText: {
        fontSize: 20,
    },
    removeButton: {
        padding: 8,
        backgroundColor: '#F0F0F0',
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    removeButtonText: {
        fontSize: 20,
    },
    acceptButton: {
        backgroundColor: COLORS.primary,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
    },
    acceptButtonText: {
        color: '#1A1A1A',
        fontWeight: '600',
        fontSize: 14,
    },
    rejectButton: {
        backgroundColor: '#F5F5F5',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
    },
    rejectButtonText: {
        color: '#666',
        fontWeight: '600',
        fontSize: 14,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyContainer: {
        padding: 40,
        alignItems: 'center',
    },
    emptyText: {
        color: '#888',
        fontSize: 16,
    },
});
