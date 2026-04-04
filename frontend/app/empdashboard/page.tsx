"use client"
import { Icon } from "@iconify/react";
import { Card, CardContent } from "../components/ui/card";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "../components/ui/table";
import { Button } from "../components/ui/button";
import EmpLayout from "../components/layout/EmpLayout";

export default function Page() {
  return (

    <EmpLayout>
      <div className="flex items-center gap-2 mb-6">
        <Icon icon="mdi:view-dashboard" className="w-5 h-5 text-blue-500" />
        <h1 className="text-blue-500 font-medium">Dashboard</h1>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="bg-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium mb-2">TOTAL EMPLOYEE</p>
                <div className="flex items-center gap-2">
                  <Icon
                    icon="mdi:account-group-outline"
                    className="w-12 h-12 text-blue-500"
                  />
                  <div className="flex items-center gap-1">
                    <Icon icon="mdi:trending-up" className="w-4 h-4 text-green-500" />
                    <span className="text-2xl font-bold text-green-500">78</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium mb-2">DEPARTMENT</p>
                <div className="flex items-center gap-2">
                  <Icon
                    icon="mdi:office-building-outline"
                    className="w-12 h-12 text-blue-500"
                  />
                  <div className="flex items-center gap-1">
                    <Icon icon="mdi:trending-up" className="w-4 h-4 text-blue-500" />
                    <span className="text-2xl font-bold text-blue-500">72</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium mb-2">PRESENT</p>
                <div className="flex items-center gap-2">
                  <Icon
                    icon="mdi:account-check-outline"
                    className="w-12 h-12 text-blue-500"
                  />
                  <div className="flex items-center gap-1">
                    <Icon icon="mdi:trending-up" className="w-4 h-4 text-blue-500" />
                    <span className="text-2xl font-bold text-blue-500">0</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium mb-2">ABSENT</p>
                <div className="flex items-center gap-2">
                  <Icon
                    icon="mdi:account-remove-outline"
                    className="w-12 h-12 text-red-500"
                  />
                  <div className="flex items-center gap-1">
                    <Icon icon="mdi:trending-down" className="w-4 h-4 text-red-500" />
                    <span className="text-2xl font-bold text-red-500">78</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="bg-white">
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Today Attendance</h2>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Photo</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>In time</TableHead>
                    <TableHead>Out Time</TableHead>
                    <TableHead>Late</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                      No data available
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <Card className="bg-white mt-6">
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                HEY ADMIN PLEASE CHECK IN/OUT YOUR ATTENDANCE
              </h2>
              <div className="space-y-4">
                <p className="text-gray-600">Your IP is 49.36.9.26</p>
                <Button className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2">
                  <Icon icon="mdi:clock-check-outline" className="w-4 h-4 mr-2" />
                  Check In
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
        <div>
          <Card className="bg-white">
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">NOTICE BOARD</h2>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Icon icon="mdi:flag" className="w-6 h-6 text-blue-500 mt-1" />
                  <div>
                    <h3 className="font-medium text-gray-900 mb-1">Meeting..</h3>
                    <p className="text-sm text-gray-500 mb-1">
                      Published Date: 12 Mar 2026
                    </p>
                    <p className="text-sm text-gray-500">Publish By: Admin</p>
                    <p className="text-sm text-gray-500 mt-2">Description</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
</EmpLayout>
  );
}
