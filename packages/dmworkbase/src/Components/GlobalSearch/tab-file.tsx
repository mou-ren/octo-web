import React, { Component } from "react";
import { ReactNode } from "react";
import ItemFile from "./item-file";
import WKApp from "../../App";
import "./tab-file.css"
import WKSDK, { Channel, ChannelInfo, ChannelInfoListener, ChannelTypePerson } from "wukongimjssdk";
import { debounce } from "../../Utils/rateLimit";
import VisibilityTrigger from "../VisibilityTrigger";

interface TabFileProps {
    keyword?: string;
    files?: any[];
    loadMore?: () => void; // 添加加载更多的回调函数
    onClick?: (item: any) => void;
}

export default class TabFile extends Component<TabFileProps> {

    // 懒加载：仅视口内的文件才拉发送者 channelInfo。debounce 合批 forceUpdate，
    // fetchedUids 防止同 uid 重复请求。
    private _channelInfoListener!: ChannelInfoListener
    private _forceUpdateDebounced = debounce(() => this.forceUpdate(), 150)
    private fetchedUids = new Set<string>()

    componentDidMount() {
        this._channelInfoListener = (channelInfo: ChannelInfo) => {
            if (channelInfo?.channel?.channelType === ChannelTypePerson) {
                this._forceUpdateDebounced()
            }
        }
        WKSDK.shared().channelManager.addListener(this._channelInfoListener)
    }

    componentWillUnmount() {
        if (this._channelInfoListener) {
            WKSDK.shared().channelManager.removeListener(this._channelInfoListener)
        }
        this._forceUpdateDebounced.cancel()
    }

    private requestSenderChannelInfoIfNeeded = (fromUid: string) => {
        if (!fromUid || this.fetchedUids.has(fromUid)) return
        const senderChannel = new Channel(fromUid, ChannelTypePerson)
        if (WKSDK.shared().channelManager.getChannelInfo(senderChannel)) return
        this.fetchedUids.add(fromUid)
        WKSDK.shared().channelManager.fetchChannelInfo(senderChannel)
    }

    // Sticky files：父层 tab 切换中途会把 files 置为 undefined，保留上次非空
    // 值继续渲染，避免列表 DOM 销毁-重建触发重复请求。
    private stickyFiles?: any[]

    handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
        if (scrollTop + clientHeight >= scrollHeight) {
            if (this.props.loadMore) {
                this.props.loadMore();
            }
        }
    };
    render(): ReactNode {
        const incoming = this.props.files
        if (incoming !== undefined) {
            this.stickyFiles = incoming
        }
        const files = this.stickyFiles
        return <div className="wk-tab-file" onScroll={this.handleScroll}>
            {
                files?.map((item: any) => {
                    let sender;
                    let needFetchSender = false
                    const senderChannel = new Channel(item.from_uid, ChannelTypePerson)
                    const channelInfo = WKSDK.shared().channelManager.getChannelInfo(senderChannel)
                    if (channelInfo) {
                        sender = channelInfo.title
                    } else {
                        // 懒加载：由 VisibilityTrigger 进入视口时触发
                        needFetchSender = true
                    }

                    const fileNode = <ItemFile
                        sender={sender}
                        message={item}
                        onClick={()=>{
                            if(this.props.onClick) {
                                this.props.onClick(item)
                            }
                        }}
                    />

                    if (needFetchSender) {
                        return <VisibilityTrigger
                            key={item.message_idstr}
                            onVisible={() => this.requestSenderChannelInfoIfNeeded(item.from_uid)}
                        >
                            {fileNode}
                        </VisibilityTrigger>
                    }
                    return <React.Fragment key={item.message_idstr}>{fileNode}</React.Fragment>
                })
            }
        </div>
    }
}
