import { Entity, Column, PrimaryGeneratedColumn, ManyToOne } from 'typeorm';
import { Subscription } from '../../subscriptions/entities/subscription.entity';
import { Node } from '../../nodes/entities/node.entity';
import { Tunnel } from '../../tunnels/entities/tunnel.entity';

@Entity()
export class Inbound {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  xuiId: number;

  @Column({ default: false })
  isPending: boolean;

  @Column()
  port: number;

  @Column()
  protocol: string;

  @Column({ nullable: true })
  remark: string;

  @Column({ type: 'text', nullable: true })
  link: string;

  @ManyToOne(() => Subscription, (sub) => sub.inbounds, { onDelete: 'CASCADE' })
  subscription: Subscription;

  @Column({ nullable: true })
  nodeId?: string;

  @ManyToOne(() => Node, (node) => node.inbounds, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  node?: Node;

  @Column({ nullable: true })
  relayServerId?: number;

  @ManyToOne(() => Tunnel, { nullable: true, onDelete: 'SET NULL' })
  relayServer?: Tunnel;
}
