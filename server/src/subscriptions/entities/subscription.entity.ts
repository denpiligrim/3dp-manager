import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
} from 'typeorm';
import { Inbound } from '../../inbounds/entities/inbound.entity';
import { Node } from '../../nodes/entities/node.entity';
import { Tunnel } from '../../tunnels/entities/tunnel.entity';

@Entity()
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  note?: string;

  @Column({ nullable: true })
  supportUrl?: string;

  @Column({ nullable: true })
  websiteUrl?: string;

  @Column({ type: 'simple-json', nullable: true })
  clientUsage?: {
    upload: number;
    download: number;
    total: number;
    expire: number;
  };

  @Column({ unique: true })
  uuid: string;

  @Column({ nullable: true })
  clientId?: string;

  @Column({ default: false })
  clientAutoCreate?: boolean;

  @Column({ default: true })
  isEnabled: boolean;

  @Column({ default: true })
  isAutoRotationEnabled: boolean;

  @Column({ type: 'simple-json', nullable: true })
  inboundsConfig: Array<{
    type?: string;
    port?: number | string;
    sni?: string;
    link?: string;
    nodeId?: string;
    relayServerId?: number;
    flag?: string;
    name?: string;
    certificateFile?: string;
    keyFile?: string;
    routingProfile?: string;
  }>;

  @Column({ nullable: true })
  nodeId?: string;

  @ManyToOne(() => Node, (node) => node.subscriptions, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  node?: Node;

  @Column({ nullable: true })
  relayServerId?: number;

  @ManyToOne(() => Tunnel, { nullable: true, onDelete: 'SET NULL' })
  relayServer?: Tunnel;

  @OneToMany(() => Inbound, (inbound) => inbound.subscription)
  inbounds: Inbound[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
