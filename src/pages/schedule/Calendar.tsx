import React, { Children, useCallback, useEffect, useMemo, useState } from 'react';
import { instance } from '../../axios';
import { AppComponentProps } from '../../components/Route';
import { environment } from '../../environments/environment';
import { Calendar, momentLocalizer, SlotInfo } from 'react-big-calendar'
import { close } from 'ionicons/icons';
import './Schedule.css'
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import moment from 'moment';
import { IonButton, IonContent, IonHeader, IonIcon, IonModal, IonPopover,  IonToolbar, useIonToast } from '@ionic/react';
import { useHistory} from "react-router";
import MintChart from './MintChart';
import Loader from '../../components/Loader';



const ScheduleCalendar: React.FC<AppComponentProps> = () => {
    /**
     * States & Variables
     */
    const history = useHistory();
    const localizer = momentLocalizer(moment)
    const [present, dismiss] = useIonToast();
    const [isMobile, setIsMobile] = useState(false);
    const [selectDate, setSelectDate] = useState<any>(moment().toDate())
    const [myEvents, setEvents] = useState<any>()
    const [openEventModal, setOpenEventModal] = useState<any>(false)
    const [mints, setMints] = useState<any>([])
    const [isLoading, setIsLoading] = useState(false);
    const [selectedEvent,setSelectedEvent] = useState<any>()
    const [showMorePopup, setShowMorePopup] = useState<boolean>(true)
    const [width, setWidth] = useState(window.innerWidth);


    /**
     * Use Effects
     */
     const chartHeight = useMemo(() => {
        if (width > 1536) return 100;
        if (width > 1280) return 115;
        if (width > 1024) return 135;
        if (width > 768) return 180;
        if (width > 640) return 225;
        return 140;
    }, [width]);

    useEffect(() => {
        fetchMintsData();
    }, []);

    useEffect(() => {
        let tempArray = []
        if(mints?.length>0){
            for (let index = 0; index < mints.length; index++) {
                if(mints[index].mints.length>0){
                    for (let i = 0; i < mints[index].mints.length; i++) {
                        tempArray.push({
                            id: mints[index].mints[i].id,
                            title: mints[index].mints[i].name,
                            start: moment (mints[index].date,'DD MM YYYY').toDate(),
                            end: moment(mints[index].date,'DD MM YYYY' ).toDate()
                        })
                    }
                }
            }
        }
        setEvents(tempArray)
    }, [mints])

    
    useEffect(() => {
        if (window.innerWidth < 525) {
            setIsMobile(true);
        }
    }, [window.innerWidth]);

   /**
     * Functions
     */ 
    const fetchMintsData = () => {
        setIsLoading(true);

        instance
            .get(environment.backendApi + '/getAllMints')
            .then(async (res) => {
                setMints(res.data.data);
                setIsLoading(false);
            })
            .catch((error) => {
                setIsLoading(false);
                let msg = '';
                if (error && error.response) {
                    msg = String(error.response.data.body);
                } else {
                    msg = 'Unable to connect. Please try again later';
                }
                present({
                    message: msg,
                    color: 'danger',
                    duration: 5000,
                    buttons: [{ text: 'X', handler: () => dismiss() }],
                });
            })
    }

 
    const handleSlotSelect = (slotInfo: SlotInfo) => {
        onNavigate(moment(slotInfo.slots[0]).toDate());
     };

     // select event handler
    const handleSelectEvent = useCallback((event) => {
         setOpenEventModal(true)
         setSelectedEvent(event)
         setShowMorePopup(false)
    },[])


    // next previous day and month

   const NextPrevMonth = (type:string) => {
       if(type === "prevMonth"){
           onNavigate(moment(selectDate).add(-1,'months').toDate())
       } else if(type === "currentMonth"){
           onNavigate(moment().toDate())
       } else if (type === "nextMonth"){
           onNavigate(moment(selectDate).add(1,'months').toDate())
       }
   }
   const NextPrevDate = (type:string) => {
       if(type === "prevDay"){
           onNavigate(moment(selectDate).add(-1,'days').toDate())
       } else if(type === "today"){
           onNavigate(moment().toDate())
       } else if (type === "nextDay"){
           onNavigate(moment(selectDate).add(1,'days').toDate())
       }
   }

   const onNavigate = (action: Date) =>{
       setSelectDate(action)
   }

  // calendar custom toolbar button
   const CustomCalenderToolbar  = () => {
       return (
           <div className='rbc-toolbar flex justify-between mt-4'>
               <div>
                   <button type="button" className={isMobile ? 'w-2.5 ml-2' : ''} onClick={()=> NextPrevMonth('prevMonth')} >{"<"}</button>
                   <button type="button"  onClick={()=> NextPrevMonth('currentMonth')}>{moment(selectDate).format('MMM')}</button>
                   <button type="button" className={isMobile ? 'w-2.5' : ''} onClick={()=> NextPrevMonth('nextMonth')} >{">"}</button>
               </div>
               <div>
                   <button type="button" className={isMobile ? 'w-2.5 ' : ''} onClick={()=> NextPrevDate('prevDay')}>{"<"}</button>
                   <button type="button" onClick={()=> NextPrevDate('today')} >{moment(selectDate).format('LL')}</button>
                   <button type="button" className={isMobile ? 'w-2.5' : ''} onClick={()=> NextPrevDate('nextDay')} >{">"}</button>
               </div>
           </div>
         );
   }

    return (
            <>
            {isLoading ? 
                <div className='flex justify-center items-center mt-4'><Loader/></div>
                 : 
                 <>
                    <div className= {`${isMobile ? "text-center" : 'text-left' } text-2xl `}>
                        Mint Calendar
                        <a className="float-right text-base underline cursor-pointer "onClick= {() => history.push( { pathname: '/schedule'})}>
                            <IonIcon icon={close} className="text-3xl " />
                        </a>
                    </div>
                    <div className="ml-3 mr-3">
                        <Calendar
                                defaultDate={ moment().add(-1, "days").toDate()}
                                views={['month']}
                                events={myEvents}
                                components = {{
                                    toolbar : CustomCalenderToolbar,
                                    // dateCellWrapper: ColoredDateCellWrapper,
                                }}
                                localizer={localizer}
                                onSelectEvent={handleSelectEvent}
                                onSelectSlot={(e: any)=>{handleSlotSelect(e)}}
                                selectable
                                onNavigate = {(action: Date)=> onNavigate(action)}
                                style={{ height: isMobile ? 500 : 700 }}
                                startAccessor='start'
                                endAccessor='end'
                                date={selectDate}
                                popup={showMorePopup}
                                // eventPropGetter={eventPropGetter}
                        />
                    </div>
                    <IonModal isOpen={openEventModal} onDidDismiss={() => {setOpenEventModal(false); setShowMorePopup(true)}} cssClass={isMobile ? 'calender-modal-mobile' :'calender-modal-web'} >
                        <IonHeader>
                            <IonToolbar className='flex items-center justify-between'>
                                <div className='float-left ml-3 font-bold'>
                                    {selectedEvent?.title}
                                </div>
                                <div>
                                    <a className="float-right text-base cursor-pointer mr-3" onClick={() => {setOpenEventModal(false); setShowMorePopup(true)}}>
                                        <IonIcon icon={close} className="h-6 w-6" />
                                    </a>
                                </div>
                            </IonToolbar>
                        </IonHeader>

                        <IonContent  >
                            <div className='ml-4 mt-4 mr-4'>
                                <MintChart selectedEvent = {selectedEvent}/>
                            </div>
                        </IonContent>
                    </IonModal>
                </> }
            </>
    );
};

export default ScheduleCalendar;