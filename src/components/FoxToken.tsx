import {
    IonButton,
    IonList,
    IonLabel,
    IonItem,
    IonCheckbox,
    IonInput,
    IonRow,
    IonCol,
    IonItemDivider,
    IonModal,
    IonContent,
    IonHeader,
    IonToolbar, IonTitle, useIonToast, IonIcon
} from '@ionic/react';
import React, {KeyboardEvent, KeyboardEventHandler, useEffect, useMemo, useRef, useState} from 'react';
import {Table} from 'antd' // https://ant.design/components/table/
import { ColumnsType } from 'antd/es/table';
import Loader from "./Loader";
import {instance} from "../axios";
import {environment} from "../environments/environment";
import {ChartData} from "chart.js";
import {Chart} from "react-chartjs-2";
import {getDailyCountData} from "../util/charts";
import moment from "moment";
import * as solanaWeb3 from '@solana/web3.js';
import {wallet} from "ionicons/icons";
import {useSelector} from "react-redux";
import {RootState} from "../redux/store";
import ReactTooltip from "react-tooltip";
import Cookies from "universal-cookie";
import {getLiveFoxTokenData} from "./FoxTokenFns";

/**
 * IF WANT TO TEST THIS PAGE
 * - be logged out of wallet and test things
 * - be logged out of wallet, and add a custom wallet
 * - log in wallet, test
 * - log in wallet, add 1-2 custom wallets
 */

interface FoxToken {
    foo?: string;
    onSubmit(bar: string): unknown;
}

function FoxToken({foo, onSubmit}: FoxToken) {

    /**
     * Adding multiple wallets
     */
    const [addMultWallModalOpen, setAddMultWallModalOpen] = useState(false); // model open or not
    const [formWalletMult, setFormWalletMult] = useState(''); // single wallet in the form
    const [formLoadingMultWallet, setFormLoadingMultWallet] = useState(false); // form loading

    const cookies = useMemo(() => new Cookies(), []);
    const [multWalletAryFromCookie, setMultWalletAryFromCookie] = useState(cookies.get('multWalletsAry')); // mult. wallets you have from cookies
    // clicked link to add multiple wallets
    const clickedMultWall = (val: boolean) => {
        setAddMultWallModalOpen(val);
    }

    // in the modal for multiple wallets - submit button clicked
    const addMultWalletsSubmit = () => {

        if (!formWalletMult || formWalletMult.length !== 44) {
            present({
                message: 'Error - please enter a single, valid SOL wallet address',
                color: 'danger',
                duration: 5000
            });
            return;
        }

        setFormLoadingMultWallet(true);

        try {
            // let existingMultWalletsAry = cookies.get('multWalletsAry');
            // didn't set any yet
            if (!multWalletAryFromCookie) {
                cookies.set("multWalletsAry", formWalletMult);
                setMultWalletAryFromCookie(formWalletMult);
                // update cookie
            } else {
                const newVal = multWalletAryFromCookie + ',' + formWalletMult;
                cookies.set("multWalletsAry", newVal.toString());
                setMultWalletAryFromCookie(newVal);
            }

            // setFormErrMsg('');

            setFormLoadingMultWallet(false); // loading false
            setFormWalletMult(''); // clear the form
            setMultWalletAryFromCookie(cookies.get('multWalletsAry')); // set array to show user on frontend

            present({
                message: 'Successfully added the wallet',
                color: 'success',
                duration: 5000
            });

        } catch (err) {
            console.error(err);
            setFormLoadingMultWallet(false); // loading false

            present({
                message: 'An error occurred when adding your Wallet',
                color: 'danger',
                duration: 5000
            });
        }
    }

    const resetMultWallets = () => {

        // @ts-ignore
        present({
            cssClass: '',
            header: 'Delete Wallets?',
            message: 'Are you sure you want to reset all of your stored wallets?',
            buttons: [
                'Cancel',
                {
                    text: 'Ok', handler: () => {

                        cookies.remove("multWalletsAry");

                        present({
                            message: 'Successfully removed all wallets.',
                            color: 'success',
                            duration: 5000
                        });

                        setMultWalletAryFromCookie(null);

                    }
                },
            ],
        });

    }


    /**
     * States & Variables
     */
    const [width, setWidth] = useState(window.innerWidth);

    // for setting height of chart, depending on what width browser is
    const tableHeight = useMemo(() => {
        if (width > 1536) return 150;
        if (width > 1280) return 180;
        if (width > 1024) return 220;
        if (width > 768) return 260;
        if (width > 640) return 280;
        return 330;
    }, [width]);

    const [tableData, setTableData]: any = useState([]);
    const [fullTableData, setFullTableData] = useState([]);
    const [tokenClickedOn, setTokenClickedOn] = useState();
    const [mySolBalance, setMySolBalance] = useState("");

    const [mySplTokens, setMySplTokens]: any = useState([]);
    const firstUpdate = useRef(true);

    const [viewMyTokensClicked, setViewMyTokensClicked] = useState(false);
    const walletAddress = useSelector(
        (state: RootState) => state.wallet.walletAddress
    );

    const smallWidthpx = 768;

    const defaultGraph: ChartData<any, string> = {
        labels: [],
        datasets: [],
    };
    const [foxLineData, setFoxLineData] = useState(defaultGraph);
    const [foxLineListingsData, setFoxLineListingsData] = useState(defaultGraph);


    const columns: ColumnsType<any> = [
        {
            title: 'Token', key: 'token', // dataIndex: 'token',
            render: record => (
                <>
                    <span hidden={width < smallWidthpx}>{record.token}</span>
                    <span hidden={width > smallWidthpx}>{shortenedWallet(record.token)}</span>
                </>

            ),
            sorter: (a, b) => a.token.localeCompare(b.token),
            // width: 130,
            responsive: ['xs', 'sm'], // Will be displayed on every size of screen
        },
        {
            title: 'Price', key: 'floorPrice', dataIndex: 'floorPrice', width: 100,
            sorter: (a, b) => a.floorPrice - b.floorPrice,
            responsive: ['xs', 'sm'], // Will be displayed on every size of screen
        },
        {
            title: 'Name', key: 'name', dataIndex: 'name',
            sorter: (a, b) => a.name.localeCompare(b.name),
            width: 150,
            responsive: ['xs', 'sm'], // Will be displayed on every size of screen
        },
        {
            title: 'Total Token Listings', key: 'totalTokenListings', dataIndex: 'totalTokenListings', width: 250,
            sorter: (a, b) => a.totalTokenListings - b.totalTokenListings,
            responsive: ['md'], // Will not be displayed below 768px
        },
        {
            title: 'View Chart', key: '', width: 150,
            render: record => (
                <span onClick={() => viewChart(record.token, record.name)}
                      className="cursor-pointer big-emoji">📈</span>
            ),
            responsive: ['xs', 'sm'], // Will be displayed on every size of screen
        },
        {
            title: 'View in Explorer', key: '', width: 150,
            render: record => (
                <a target="_blank" className="no-underline big-emoji"
                   href={'https://explorer.solana.com/address/' + record.token}>🌐</a>
            ),
            responsive: ['md'], // Will not be displayed below 768px
        },
        {
            title: 'Which Of My Wallet(s)', key: 'whichMyWallets', width: 180, dataIndex: 'whichMyWallets',
            responsive: ['md'], // Will not be displayed below 768px
            // sorter: (a, b) => a.whichMyWallets.localeCompare(b.whichMyWallets),
        }
    ];

    /**
     * Use Effects
     */
    // useEffect(() => {
    //
    // }, []);

    // resize window
    useEffect(() => {
        function resizeWidth() {
            setWidth(window.innerWidth);
        }

        window.addEventListener('resize', resizeWidth);
        return () => window.removeEventListener('resize', resizeWidth);
    }, []);

    /**
     * Functions
     */
    // user wants to only see verified collections
    const setCheckedVerifiedOnly = (e: any) => {

    }

    // viewing the chart for a token
    const viewChart = (token: string, name: string) => {

        setFoxLineData(defaultGraph);
        setFoxLineListingsData(defaultGraph);

        // @ts-ignore
        setTokenClickedOn(name ? `${name} (${token})` : token);

        instance
            .get(environment.backendApi + '/receiver/foxTokenHistory?token=' + token)
            .then((res) => {

                const labels = res.data.map((el: { createdAt: any; }) => moment(el.createdAt).fromNow());

                const lineData = res.data.map((el: { floorPrice: any; }) => parseFloat(el.floorPrice));
                // console.log(lineData);
                let datasetsAry = [{
                    type: 'line' as const,
                    label: 'Floor Price',
                    borderColor: 'white',
                    borderWidth: 2,
                    fill: false,
                    data: lineData,
                }];

                const listingsData = res.data.map((el: { totalTokenListings: any; }) => parseInt(el.totalTokenListings));
                // console.log(listingsData);
                let datasetsAryListings = [{
                    type: 'line' as const,
                    label: 'Total Token Listings',
                    borderColor: 'blue',
                    borderWidth: 2,
                    fill: false,
                    data: listingsData,
                }];

                // console.log(labels);
                // console.log(datasetsAry);
                // console.log(datasetsAryListings);

                setFoxLineData({
                    labels: labels,
                    datasets: datasetsAry
                });
                setFoxLineListingsData({
                    labels: labels,
                    datasets: datasetsAryListings
                });

                // think want to keep this in ... some timing ... issue....
                // console.log(foxLineData);


                // TODO-rakesh: go to the home page ... go to fox token table ... click view chart ... make sure it SCROLLS TO BOTTOM of page (or scrolls to make the chart the top of the page)
                // window.scrollTo(0,document.body.scrollHeight);

            })
            .catch((err) => {
                console.error("error when getting fox token history data: " + err);
            });

    }

    // load table data!
    const fetchTableData = async () => {

        setTableData([]);

        const liveData = await getLiveFoxTokenData();
        setTableData(liveData)
        console.log(liveData); // TODO

        // instance
        //     .get(environment.backendApi + '/receiver/foxTokenAnalysis')
        //     .then((res) => {
        //
        //         const data = res.data.data;
        //         // const newData = [];
        //         //
        //         //
        //         // for(let i in data){
        //         //     if(data[i].customName){
        //         //         newData.push(data[i]);
        //         //     }
        //         // }
        //
        //         // console.log(mySplTokens);
        //
        //         // loop through table data (all fox tokens)... to eventually add which of these are your SPL tokens
        //         for (let i in data) {
        //             // loop through user tokens
        //             for (let y in mySplTokens) {
        //                 // if match
        //                 // @ts-ignore
        //                 if (mySplTokens[y].token === data[i].token) {
        //                     // then ADD data
        //                     // @ts-ignore
        //                     if (!data[i].whichMyWallets) {
        //                         data[i].whichMyWallets = shortenedWallet(mySplTokens[y].myWallet);
        //                     }
        //                     // @ts-ignore
        //                     else {
        //                         data[i].whichMyWallets += ", " + shortenedWallet(mySplTokens[y].myWallet);
        //                     }
        //
        //                     break;
        //                 }
        //             }
        //         }
        //
        //         setTableData(data);
        //         setFullTableData(data);
        //     })
        //     .catch((err) => {
        //         console.error("error when getting fox token data: " + err);
        //     });
    }


    // give a wallet ... return all spl tokens in it
    const getSplFromWallet = async (wallet: string) => {

        try {
            // console.log("going out to " + wallet);

            // https://docs.solana.com/developing/clients/javascript-reference
            let base58publicKey = new solanaWeb3.PublicKey(wallet.toString());

            const connection = new solanaWeb3.Connection(
                solanaWeb3.clusterApiUrl('mainnet-beta'), 'confirmed',
            );

            // let account = await connection.getAccountInfo(base58publicKey);
            // console.log(account?.data);
            // https://github.com/solana-labs/solana/blob/master/web3.js/examples/get_account_info.js
            let balance = await connection.getBalance(base58publicKey); // SOL balance
            balance = balance / 1000000000;
            // @ts-ignore
            setMySolBalance(balance);

            // https://github.com/michaelhly/solana-py/issues/48
            let tokenAccounts = await connection.getParsedTokenAccountsByOwner(
                base58publicKey,
                {programId: new solanaWeb3.PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")},
            );

            let mySplTokensTemporaryAgainAgain: any = [];

            for (let i in tokenAccounts.value) {
                if (tokenAccounts.value[i]?.account?.data?.parsed?.info?.tokenAmount.uiAmount !== 0) {
                    // console.log(tokenAccounts.value[i]);
                    mySplTokensTemporaryAgainAgain.push({
                        token: tokenAccounts.value[i]?.account?.data?.parsed?.info?.mint,
                        myWallet: wallet
                    });
                }
            }

            return mySplTokensTemporaryAgainAgain;

        } catch (err) {
            present({
                message: 'Error when getting your Whitelist tokens from your wallet',
                color: 'danger',
                duration: 5000
            });

            return [];
        }

    }

    // https://github.com/solana-labs/solana-program-library/blob/master/token/js/examples/create_mint_and_transfer_tokens.ts
    // https://docs.solana.com/es/developing/clients/jsonrpc-api#gettokenaccountsbyowner
    const getUserSpls = async () => {
        let mySplTokensTemporary: any = [];

        // if no wallet is logged in ... OR didn't set multiple wallets in a cookie, then return table and do nothing else
        // if(!walletAddress && !multWalletAryFromCookie){
        //     await fetchTableData();
        //     return;
        // }

        // first try with the wallet address we got logged in
        if (walletAddress) {
            // @ts-ignore
            mySplTokensTemporary = mySplTokensTemporary.concat(await getSplFromWallet(walletAddress));
        }

        // now go through the wallets in cookies
        if (multWalletAryFromCookie) {
            for (let i in multWalletAryFromCookie.split(",")) {
                const tempWall = multWalletAryFromCookie.split(",")[i];
                // make sure it's length of a sol wallet ... and that its not the connected wallet
                if (tempWall.length === 44 && tempWall !== walletAddress) {
                    mySplTokensTemporary = mySplTokensTemporary.concat(await getSplFromWallet(tempWall));
                }

            }
        }

        // @ts-ignore
        setMySplTokens(mySplTokensTemporary);

        // console.log(mySplTokensTemporary);
    }

    // load table data, after we load in user tokens
    // isn't called on local host, see below useEffect
    useEffect(() => {
        if (firstUpdate.current) {
            firstUpdate.current = false;
            return;
        }

        // only fetch data when NOT on local host ... after spl tokens is updated
        if (window.location.href.indexOf('localhost') === -1) {
            fetchTableData();
        }

    }, [mySplTokens]);

    // call on load, when cookie array set
    useEffect(() => {

        // however DON'T do this in local host (will do this elsewhere ... since get RPC blocked)
        if (window.location.href.indexOf('localhost') === -1) {
            getUserSpls();
        } else {
            fetchTableData();
        }


    }, [multWalletAryFromCookie]);
    // also call when new wallet is connected to
    useEffect(() => {
        if (window.location.href.indexOf('localhost') === -1) {
            getUserSpls();
        }
        // @ts-ignore
    }, [walletAddress]);

    /**
     * for submitting custom token names
     */
    const [addNameModalOpen, setAddNameModalOpen] = useState(false);
    const [formToken, setFormToken] = useState('');
    const [formName, setFormName] = useState('');
    const [formLoading, setFormLoading] = useState(false);
    const [formErrMsg, setFormErrMsg] = useState('');
    const [present, dismiss] = useIonToast();
    const clickedAddName = (val: boolean) => {
        setAddNameModalOpen(val);
    }

    // submit form to add new wallet
    const submittedForm = () => {

        const body = {
            formToken: formToken,
            formName: formName,
        }

        setFormLoading(true);
        setFormErrMsg('');

        instance.post(environment.backendApi + '/receiver/foxTokenNameAdd', body).then(resp => {

            // console.log(resp);

            if (resp.data.error) {
                setFormLoading(false);
                if (resp.data.message) {
                    setFormErrMsg(resp.data.message);
                } else {
                    setFormErrMsg('An error occurred. Please contact us if this continues to happen');
                }

            } else {
                setFormLoading(false);
                setFormToken('');
                setFormName('');

                clickedAddName(false);

                // show toast
                present({
                    message: 'Successfully added the name. Refresh to see it',
                    color: 'success',
                    duration: 5000
                });
            }

        }).catch(err => {
            console.error(err);

            setFormLoading(false);
            setFormErrMsg(err);
        });
    }

    const shortenedWallet = (wallet: string) => {
        return wallet.substring(0, 4) +
            '...' +
            wallet.substring(wallet.length - 4);
    };

    // Viewing MY tokens - filter the table
    const viewMyTokens = async (wantViewTokens: boolean) => {

        // user wants to see MY tokens
        if (wantViewTokens) {

            // see other local host on here to see why
            if (window.location.href.indexOf('localhost') !== -1) {
                await getUserSpls();
            }

            if (!multWalletAryFromCookie && !walletAddress) {
                present({
                    message: 'Please connect to your wallet, or click "Add Multiple Wallets" to add it manually',
                    color: 'danger',
                    duration: 5000
                });
                return;
            }

            // make sure they have tokens
            if (mySplTokens.length === 0) {

                // show toast
                present({
                    message: 'No tokens found on your wallet(s) :(',
                    color: 'danger',
                    duration: 5000
                });
                return;

            } else {

                setViewMyTokensClicked(true);

                // new array of data we'll set later
                let newTableData: any = [];

                // loop through table data (all fox tokens)
                for (let i in tableData) {
                    // if match, then push
                    for (let y in mySplTokens) {
                        // @ts-ignore
                        if (mySplTokens[y].token === tableData[i].token) {

                            if (window.location.href.indexOf('localhost') !== -1) {
                                // then ADD data
                                // @ts-ignore
                                if (!tableData[i].whichMyWallets) {
                                    tableData[i].whichMyWallets = shortenedWallet(mySplTokens[y].myWallet);
                                }
                                // @ts-ignore
                                else {
                                    tableData[i].whichMyWallets += ", " + shortenedWallet(mySplTokens[y].myWallet);
                                }
                            }

                            newTableData.push(tableData[i]);
                            break;
                        }
                    }
                }

                if (newTableData.length === 0) {
                    present({
                        message: 'None of your tokens are also listed on FF Token Market :(',
                        color: 'danger',
                        duration: 5000
                    });
                    return;
                }

                setTableData(newTableData);
            }

            // user wants to see ALL tokens
        } else {
            setViewMyTokensClicked(false);

            setTableData(fullTableData);
        }
    };

    /**
     * Renders
     */

    return (
        <>
            <div className={`w-full bg-satin-3 rounded-lg pt-3 pb-6 pr-3 pl-3 h-fit xl:pb-3 2xl:pb-2 lg:pb-4`}>

                <div className={`font-bold pb-1 w-full`}>
                    <a href="https://famousfoxes.com/tokenmarket" className="underline" target="_blank">
                        Fox Token Market - Analysis
                    </a>

                    {/*DESKTOP*/}
                    <span hidden={width <= smallWidthpx} className="float-right">
                        <IonButton color="success" className="text-sm small-btn pl-5"
                                   onClick={() => clickedAddName(true)}
                            // data-tip="Add a custom name to one of the nameless Fox Tokens, if you know it"
                        >
                            ➕ Add custom name
                        </IonButton>

                        <IonButton color="secondary" className="text-sm small-btn ml-5"
                                   onClick={() => viewMyTokens(true)}
                                   hidden={viewMyTokensClicked}
                            // data-tip="Filter the table to view only your tokens"
                        >
                            <IonIcon icon={wallet} className="pr-1"/>
                            View My Tokens
                        </IonButton>
                        <IonButton color="secondary" className="text-sm small-btn ml-5"
                                   onClick={() => viewMyTokens(false)}
                                   hidden={!viewMyTokensClicked}
                                   data-tip="View All Tokens"
                        >
                            <IonIcon icon={wallet} className="pr-1"/>
                            View All Tokens
                        </IonButton>

                        <IonButton color="secondary" className="text-sm small-btn ml-5"
                                   onClick={() => clickedMultWall(true)}
                            // data-tip="Add multiple wallets "
                        >
                            <IonIcon icon={wallet} className="pr-1"/>
                            Add Mult Wallets
                        </IonButton>

                    </span>

                    {/*MOBILE*/}
                    <span hidden={width > smallWidthpx} className="float-right">
                        <a onClick={() => clickedAddName(true)} data-tip="Add a custom name">➕</a>

                        <a hidden={viewMyTokensClicked}
                           data-tip="Filter the table to view only your tokens"
                           onClick={() => viewMyTokens(true)} className="pl-3">
                            <IonIcon icon={wallet} className="pr-1"/>
                        </a>

                         <a hidden={!viewMyTokensClicked}
                            onClick={() => viewMyTokens(false)} className="pl-3"
                            data-tip="View All Tokens">
                            <IonIcon icon={wallet} className="pr-1"/>
                        </a>
                    </span>

                    <div hidden={!tableData.length || width < smallWidthpx}>
                        👪 are community added names
                    </div>
                </div>

                {/*
                    adding multiple wallets
                */}
                <IonModal
                    isOpen={addMultWallModalOpen}
                    onDidDismiss={() => setAddMultWallModalOpen(false)}
                >

                    <IonHeader>
                        <IonToolbar>
                            <IonTitle>
                                Add Multiple Wallets
                                <a className="float-right text-base underline cursor-pointer"
                                   onClick={() => clickedMultWall(false)}>close</a>
                            </IonTitle>
                        </IonToolbar>
                    </IonHeader>

                    <IonContent className="">

                        <div
                            className="ml-12 mr-12 mb-5 relative mt-6 bg-gradient-to-b from-bg-primary to-bg-secondary p-3 rounded-xl">
                            <div className="text-lg  font-medium">
                                <p>This is used in conjuction with the "View My Tokens" button,
                                    where you can filter the Fox Token Market table to show only tokens in your wallet.
                                    Use this to filter the table to your tokens that are on multiple wallets</p>
                            </div>
                        </div>

                        <div hidden={!multWalletAryFromCookie}
                             className="ml-12 mr-12 mb-5 relative mt-6 bg-gradient-to-b from-bg-primary to-bg-secondary p-3 rounded-xl">
                            <div className="text-lg  font-medium">
                                <span className="font-bold">Wallets Added:</span>
                                <ul>
                                    {multWalletAryFromCookie ?
                                        multWalletAryFromCookie.split(',').map(function (wallet: any) {
                                            return <li>{wallet}</li>;
                                        })
                                        : ''}
                                </ul>
                            </div>
                        </div>

                        <div className="ml-12 mr-12">

                            <IonItem>
                                <IonLabel className="font-bold">Wallet</IonLabel>
                                <IonInput onIonChange={(e) => setFormWalletMult(e.detail.value!)}
                                          value={formWalletMult}
                                          placeholder="ex. 91q2zKjAATs28sdXT5rbtKddSU81BzvJtmvZGjFj54iU"></IonInput>
                            </IonItem>

                            <IonButton color="success" className="mt-5" hidden={formLoadingMultWallet}
                                       onClick={() => addMultWalletsSubmit()}>
                                Submit
                            </IonButton>
                            <IonButton
                                hidden={!multWalletAryFromCookie}
                                color="danger" className="mt-5"
                                onClick={() => resetMultWallets()}>
                                Reset Stored Wallets
                            </IonButton>

                            <div hidden={!formLoading}>Loading...</div>

                            {/*<div className="m-12 relative mt-6 bg-red-100 p-6 rounded-xl" hidden={!formErrMsg}>*/}
                            {/*    <p className="text-lg text-red-700 font-medium">*/}
                            {/*        <b>{formErrMsg}</b>*/}
                            {/*    </p>*/}
                            {/*    <span className="absolute bg-red-500 w-8 h-8 flex items-center justify-center font-bold text-green-50 rounded-full -top-2 -left-2">*/}
                            {/*        !*/}
                            {/*    </span>*/}
                            {/*</div>*/}
                        </div>

                    </IonContent>
                </IonModal>

                {/* For adding a new token */}
                <IonModal
                    isOpen={addNameModalOpen}
                    onDidDismiss={() => setAddNameModalOpen(false)}
                >

                    <IonHeader>
                        <IonToolbar>
                            <IonTitle>
                                Add a Token Name
                                <a className="float-right text-base underline cursor-pointer"
                                   onClick={() => clickedAddName(false)}>close</a>
                            </IonTitle>
                        </IonToolbar>
                    </IonHeader>

                    <IonContent className="">

                        <div
                            className="ml-12 mr-12 mb-5 relative mt-6 bg-gradient-to-b from-bg-primary to-bg-secondary p-3 rounded-xl">
                            <div className="text-lg  font-medium">
                                <p>If a token on Fox Token Market doesn't have an official name yet, and you know for
                                    certain what NFT the token is for,
                                    then you can use the below form to add that data</p>
                                <p className="mt-3">Your discord name will be recorded when submitting the form.
                                    Those abusing the service will receive such punishments as having your account
                                    banned from entering data,
                                    with severe violations being permanently muted in the Discord.</p>
                            </div>
                        </div>

                        {/*bg-gradient-to-b from-bg-primary to-bg-secondary"*/}
                        <div className="ml-12 mr-12">

                            <IonItem>
                                <IonLabel className="font-bold">Token</IonLabel>
                                <IonInput onIonChange={(e) => setFormToken(e.detail.value!)}
                                          placeholder="ex. Hxq2zKjAATs28sdXT5rbtKddSU81BzvJtmvZGjFj54iU"></IonInput>
                            </IonItem>

                            <IonItem>
                                <IonLabel className="font-bold">Name</IonLabel>
                                <IonInput onIonChange={(e) => setFormName(e.detail.value!)}
                                          placeholder="ex. Zillas vs Kong WL"></IonInput>
                            </IonItem>

                            <IonButton color="success" className="mt-5" hidden={formLoading}
                                       onClick={() => submittedForm()}>
                                Submit
                            </IonButton>

                            <div hidden={!formLoading}>Loading...</div>

                            <div className="m-12 relative mt-6 bg-red-100 p-6 rounded-xl" hidden={!formErrMsg}>
                                <p className="text-lg text-red-700 font-medium">
                                    <b>{formErrMsg}</b>
                                </p>
                                <span
                                    className="absolute bg-red-500 w-8 h-8 flex items-center justify-center font-bold text-green-50 rounded-full -top-2 -left-2">
                                    !
                                </span>
                            </div>
                        </div>

                    </IonContent>
                </IonModal>

                <div>
                    {
                        !tableData.length
                            ? <div className="pt-10 flex justify-center items-center">
                                <Loader/>
                            </div>
                            : <div className=" ">

                                {/*<IonItem style={{"width": "250px"}}>*/}
                                {/*    <IonLabel>Show Verified Only</IonLabel>*/}
                                {/*    <IonCheckbox onIonChange={e => setCheckedVerifiedOnly(e.detail.checked)} />*/}
                                {/*</IonItem>*/}

                                <div hidden={width <= smallWidthpx}>
                                    {/* Desktop version */}
                                    <Table
                                        className='pt-2 w-full'
                                        key={'name'}
                                        dataSource={tableData}
                                        columns={columns}
                                        bordered
                                        scroll={{y: 400}}
                                        // scroll={{y: 22}} // if want show it off / shill

                                        pagination={false}
                                        style={{width: '100%', margin: '0 auto', textAlign: 'center'}}
                                    />
                                </div>
                                <div hidden={width > smallWidthpx}>

                                    {/*Mobile Version*/}
                                    <Table
                                        className='pt-2 w-full'
                                        key={'name'}
                                        dataSource={tableData}
                                        columns={columns}
                                        bordered
                                        // scroll={{x: 'max-content'}}

                                        // This both x & y aren't working together properly in our project. I tested out on codesandbox. It works perfectly there!!!
                                        scroll={{x: 'max-content', y: 400}}

                                        pagination={false}
                                        style={{width: '100%', margin: '0 auto', textAlign: 'center'}}
                                    />

                                </div>

                                <div className="gap-4 mb-4 grid grid-cols-12 mt-3"
                                    // @ts-ignore
                                     hidden={foxLineData.labels.length === 0}>
                                    <div className='chart'>

                                        <Chart type='line'
                                            // @ts-ignore
                                               data={foxLineData} height={tableHeight}
                                               options={{
                                                   responsive: true,
                                                   maintainAspectRatio: true,
                                                   plugins: {
                                                       legend: {
                                                           display: false
                                                       },
                                                       title: {display: true, text: tokenClickedOn + " - Price"},
                                                   },
                                                   scales: {
                                                       x: {
                                                           ticks: {
                                                               autoSkip: true,
                                                               maxTicksLimit: 8
                                                           }
                                                       },
                                                       y: {
                                                           suggestedMin: 0,
                                                       },
                                                   }
                                               }}/>
                                    </div>
                                    <div className="chart">
                                        <Chart type='line'
                                               data={foxLineListingsData} height={tableHeight}
                                               options={{
                                                   responsive: true,
                                                   maintainAspectRatio: true,
                                                   plugins: {
                                                       legend: {
                                                           display: false
                                                       },
                                                       title: {display: true, text: 'Total Token Listings'},
                                                   },
                                                   scales: {
                                                       x: {
                                                           ticks: {
                                                               autoSkip: true,
                                                               maxTicksLimit: 8
                                                           }
                                                       },
                                                       y: {
                                                           suggestedMin: 0,
                                                       },
                                                   }
                                               }}/>
                                    </div>
                                </div>

                                <br/>

                            </div>
                    }
                </div>

                <ReactTooltip/>

                <div hidden={true}
                     className={`w-full bg-satin-3 rounded-lg pt-3 pb-6 pr-3 pl-3 h-fit xl:pb-3 2xl:pb-2 lg:pb-4`}>
                    <div className={`font-bold pb-3 w-full text-lg`}>Fox Token - Price Alerts</div>

                    <div>
                        <label className={`font-bold pb-1 w-full`} htmlFor="">Get an alert when any of your WL tokens
                            lists over a certain price</label>

                        <IonList>
                            <b>Wallet Address</b>
                            <IonItem>
                                <IonInput placeholder="Enter Wallet Address to Monitor"></IonInput>
                                {/* value={text} onIonChange={e => setText(e.detail.value!)} */}
                            </IonItem>
                        </IonList>

                        <IonList>
                            <b>Floor price of any of your WL tokens before alert</b>
                            <IonItem>
                                <IonInput placeholder="Enter price"></IonInput>
                                {/* value={text} onIonChange={e => setText(e.detail.value!)} */}
                            </IonItem>
                        </IonList>

                        <IonButton color="success" className="text-sm">
                            Submit
                        </IonButton>
                        <br/><br/>


                    </div>

                </div>

                <br/>

            </div>

        </>
    );
}
export default FoxToken;
